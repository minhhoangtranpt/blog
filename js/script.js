function processFile() {
    const fileInput = document.getElementById('fileInput');
    const resultDiv = document.getElementById('result');
    const windowMsInput = document.getElementById('windowMs');
    
    if (!fileInput.files.length) {
        alert("Vui lòng chọn file .txt!");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split(/\r?\n/);
        
        let dataStartIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes("Time (s)")) {
                // Kiểm tra nếu có hàng tiêu đề phụ (TOTAL, DIO, A, B)
                dataStartIndex = (lines[i+1] && lines[i+1].includes("TOTAL")) ? i + 2 : i + 1;
                break;
            }
        }

        if (dataStartIndex === -1) {
            resultDiv.innerHTML = "<p style='color:red;'>Lỗi: Không tìm thấy định dạng TwinPlates.</p>";
            return;
        }

        let timeData = [];
        let fzData = [];

        for (let i = dataStartIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split('\t');
            const t = parseFloat(cols[0]);
            const fz = parseFloat(cols[1]); // Cột Fz của TOTAL
            if (!isNaN(t) && !isNaN(fz)) {
                timeData.push(t);
                fzData.push(fz);
            }
        }

        try {
            // --- 1. TÍNH BASELINE & NGƯỠNG ---
            const fz5s = fzData.filter((_, idx) => timeData[idx] <= 5.0);
            const meanFz5s = jStat.mean(fz5s);
            const thresholdT0 = 0.025 * meanFz5s;

            // --- 2. TÌM T1 (MAX TRONG 10S ĐẦU) ---
            let maxFz = -Infinity;
            let T1_idx = 0;
            for (let i = 0; i < timeData.length; i++) {
                if (timeData[i] > 10.0) break;
                if (fzData[i] > maxFz) {
                    maxFz = fzData[i];
                    T1_idx = i;
                }
            }
            const T1 = timeData[T1_idx];

            // --- 3. TÌM T0 (LINH HOẠT TRƯỚC T1) ---
            // Tự động tính số mẫu dựa trên Ms người dùng nhập và Sample Rate của file
            const sampleRate = 1 / (timeData[1] - timeData[0]); 
            const windowSize = Math.ceil((windowMsInput.value / 1000) * sampleRate);
            
            let T0_val = "Không tìm thấy";
            for (let i = 0; i <= T1_idx - windowSize; i++) {
                let isStable = true;
                for (let j = 0; j < windowSize; j++) {
                    if (fzData[i + j] >= thresholdT0) {
                        isStable = false;
                        break;
                    }
                }
                if (isStable) {
                    T0_val = timeData[i].toFixed(4);
                    break;
                }
            }

            // --- 4. HIỂN THỊ KẾT QUẢ ---
            resultDiv.innerHTML = `
                <div class="card card-full animate-fade">
                    <h3>Thông số nền (0 - 5.0s)</h3>
                    <div class="value">${meanFz5s.toFixed(2)}<span class="unit">N (Lực TB)</span></div>
                    <div class="unit">Ngưỡng T0 xác định tại: ${thresholdT0.toFixed(2)} N</div>
                </div>
                
                <div class="card animate-fade" style="border-left: 5px solid #ef4444;">
                    <h3>Mốc T0 (Khởi phát)</h3>
                    <div class="value">${T0_val}</div>
                    <div class="unit">giây (Duy trì dưới ngưỡng ${windowMsInput.value}ms)</div>
                </div>

                <div class="card animate-fade" style="border-left: 5px solid #10b981;">
                    <h3>Mốc T1 (Cực đại)</h3>
                    <div class="value">${T1.toFixed(4)}</div>
                    <div class="unit">giây (Fz max: ${maxFz.toFixed(2)} N)</div>
                </div>
            `;

        } catch (err) {
            console.error(err);
            resultDiv.innerHTML = "Có lỗi xảy ra khi xử lý dữ liệu số.";
        }
    };

    reader.readAsText(file);
}
