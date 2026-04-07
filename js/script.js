function processFile() {
    console.log("Nút tính toán đã được nhấn.");
    const fileInput = document.getElementById('fileInput');
    const resultDiv = document.getElementById('result');
    
    if (!fileInput.files.length) {
        alert("Vui lòng chọn file .txt trước!");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        console.log("Đã đọc xong file.");
        const text = e.target.result;
        const lines = text.split(/\r?\n/);
        
        // Tìm dòng bắt đầu dữ liệu
        let dataStartIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes("Time (s)")) {
                dataStartIndex = i + 1;
                // Nếu có 2 dòng tiêu đề, hãy tăng thêm 1
                if (lines[i+1] && lines[i+1].includes("TOTAL")) {
                    dataStartIndex = i + 2;
                }
                break;
            }
        }

        console.log("Dữ liệu bắt đầu từ dòng số:", dataStartIndex);

        if (dataStartIndex === -1 || dataStartIndex >= lines.length) {
            resultDiv.innerHTML = "Lỗi: Không tìm thấy vùng dữ liệu hợp lệ.";
            return;
        }

        let timeData = [];
        let fzData = [];

        for (let i = dataStartIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cols = line.split('\t');
            const t = parseFloat(cols[0]);
            const fz = parseFloat(cols[1]);

            if (!isNaN(t) && !isNaN(fz)) {
                timeData.push(t);
                fzData.push(fz);
            }
        }

        console.log(`Đã trích xuất được ${timeData.length} dòng dữ liệu.`);

        if (timeData.length === 0) {
            resultDiv.innerHTML = "Lỗi: Không có dữ liệu số.";
            return;
        }

        try {
            // TÍNH TOÁN
            // 1. Lấy dữ liệu 5s đầu để tính Baseline
            const fz5s = fzData.filter((_, idx) => timeData[idx] <= 5.0);
            const meanFz5s = jStat.mean(fz5s);

            // 2. Tìm T1 (Max Fz trong 10s đầu)
            let maxFz = -Infinity;
            let T1 = 0;
            for (let i = 0; i < timeData.length; i++) {
                if (timeData[i] > 10.0) break;
                if (fzData[i] > maxFz) {
                    maxFz = fzData[i];
                    T1 = timeData[i];
                }
            }

            // 3. Tìm T0 (Fz < 2.5% của Mean 5s)
            const thresholdT0 = 0.025 * meanFz5s;
            let T0 = "Không tìm thấy";
            for (let i = 0; i < fzData.length; i++) {
                if (fzData[i] < thresholdT0) {
                    T0 = timeData[i].toFixed(4);
                    break;
                }
            }

            // HIỂN THỊ
            resultDiv.innerHTML = `
                <div style="border:1px solid #ccc; padding:15px; margin-top:10px; background:#f9f9f9;">
                    <h3>Kết quả tính toán:</h3>
                    <p>Trung bình Fz (5s đầu): <b>${meanFz5s.toFixed(2)} N</b></p>
                    <p>Ngưỡng T0 (2.5%): <b>${thresholdT0.toFixed(2)} N</b></p>
                    <hr>
                    <p><strong>T0:</strong> ${T0} s</p>
                    <p><strong>T1:</strong> ${T1.toFixed(4)} s (Fz max: ${maxFz.toFixed(2)} N)</p>
                </div>
            `;
            console.log("Hoàn tất tính toán.");

        } catch (err) {
            console.error("Lỗi tính toán:", err);
            resultDiv.innerHTML = "Lỗi trong quá trình tính toán: " + err.message;
        }
    };

    reader.readAsText(file);
}
