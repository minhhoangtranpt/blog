let fzChartInstance = null; // Biến lưu trữ đối tượng biểu đồ để có thể reset khi tính toán lại

function processFile() {
    const fileInput = document.getElementById('fileInput');
    const resultDiv = document.getElementById('result');
    const windowMsInput = document.getElementById('windowMs');
    const chartWrapper = document.getElementById('chartWrapper');
    
    if (!fileInput.files.length) {
        alert("Vui lòng chọn file .txt!");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split(/\r?\n/);
        
        // 1. Tìm dòng bắt đầu của dữ liệu (Skip Header)
        let dataStartIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes("Time (s)")) {
                // Kiểm tra nếu có hàng tiêu đề phụ (như dòng chứa chữ TOTAL)
                dataStartIndex = (lines[i+1] && lines[i+1].includes("TOTAL")) ? i + 2 : i + 1;
                break;
            }
        }

        if (dataStartIndex === -1) {
            alert("Lỗi: Không tìm thấy định dạng dữ liệu TwinPlates chuẩn.");
            return;
        }

        // 2. Trích xuất dữ liệu Cột Time và TOTAL Fz
        let timeData = [];
        let fzData = [];

        for (let i = dataStartIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split('\t');
            const t = parseFloat(cols[0]);
            const fz = parseFloat(cols[1]); // Cột Fz nằm trong nhóm TOTAL (cột thứ 2)

            if (!isNaN(t) && !isNaN(fz)) {
                timeData.push(t);
                fzData.push(fz);
            }
        }

        if (timeData.length < 2) {
            alert("Lỗi: File không chứa đủ dữ liệu số.");
            return;
        }

        try {
            // --- A. TÍNH BASELINE (TRUNG BÌNH 5 GIÂY ĐẦU) ---
            const fz5s = fzData.filter((_, idx) => timeData[idx] <= 5.0);
            const meanFz5s = jStat.mean(fz5s);

            // --- B. XÁC ĐỊNH NGƯỠNG T0 (GIẢM > 2.5% SO VỚI BASELINE) ---
            // Onset of movement: Lực rớt xuống dưới mức 97.5% của trọng lượng tĩnh
            const thresholdT0 = 0.975 * meanFz5s;

            // --- C. TÌM T1 (ĐỈNH LỰC TRONG 10 GIÂY ĐẦU) ---
            // Tìm T1 trước để làm mốc chặn (T0 phải xảy ra trước T1)
            let maxFz = -Infinity;
            let T1_idx = -1;
            for (let i = 0; i < timeData.length; i++) {
                if (timeData[i] > 10.0) break; // Giới hạn tìm kiếm trong 10s đầu
                if (fzData[i] > maxFz) {
                    maxFz = fzData[i];
                    T1_idx = i;
                }
            }
            const T1 = timeData[T1_idx];

            // --- D. TÌM T0 (KHỞI PHÁT - TRƯỚC T1) ---
            // Tính số mẫu cần thiết dựa trên ms người dùng nhập và Sample Rate thực tế
            const sampleRate = 1 / (timeData[1] - timeData[0]);
            const windowMs = parseInt(windowMsInput.value) || 20;
            const windowSize = Math.ceil((windowMs / 1000) * sampleRate);
            
            let T0_val = null;
            // Chỉ tìm kiếm trong khoảng từ đầu file đến mốc T1
            for (let i = 0; i <= T1_idx - windowSize; i++) {
                let isStableMovement = true;
                // Kiểm tra xem lực có duy trì dưới ngưỡng liên tục trong 'windowSize' mẫu không
                for (let j = 0; j < windowSize; j++) {
                    if (fzData[i + j] >= thresholdT0) {
                        isStableMovement = false;
                        break;
                    }
                }
                if (isStableMovement) {
                    T0_val = timeData[i];
                    break; // Tìm thấy mốc đầu tiên thỏa mãn thì dừng ngay
                }
            }

            // --- E. HIỂN THỊ KẾT QUẢ ---
            chartWrapper.style.display = 'block'; // Hiện khung biểu đồ
            resultDiv.innerHTML = `
                <div class="card card-full animate">
                    <h3>Thông số Baseline (0 - 5.0s)</h3>
                    <div class="value">${meanFz5s.toFixed(2)}<span class="unit">N (Trọng lượng TB)</span></div>
                    <div class="info-footer">Ngưỡng Onset T0 (< 97.5% Baseline): <b>${thresholdT0.toFixed(2)} N</b></div>
                </div>
                
                <div class="card danger-border animate">
                    <h3>Mốc T0 (Bắt đầu chuyển động)</h3>
                    <div class="value" style="color: var(--danger);">${T0_val !== null ? T0_val.toFixed(4) : "---"}</div>
                    <div class="unit">giây</div>
                    <div class="info-footer">Thời điểm lực giảm > 2.5% (Duy trì ${windowMs}ms)</div>
                </div>

                <div class="card success-border animate">
                    <h3>Mốc T1 (Lực cực đại)</h3>
                    <div class="value" style="color: var(--success);">${T1.toFixed(4)}</div>
                    <div class="unit">giây</div>
                    <div class="info-footer">Giá trị Fz Peak: ${maxFz.toFixed(2)} N</div>
                </div>
            `;

            // Vẽ biểu đồ với các mốc đã tính
            drawChart(timeData, fzData, T0_val, T1);

        } catch (err) {
            console.error("Lỗi trong quá trình xử lý:", err);
            alert("Có lỗi xảy ra khi tính toán dữ liệu số.");
        }
    };

    reader.readAsText(file);
}

function drawChart(labels, data, T0, T1) {
    const ctx = document.getElementById('fzChart').getContext('2d');
    
    // Reset biểu đồ cũ nếu đã tồn tại
    if (fzChartInstance) {
        fzChartInstance.destroy();
    }

    // Cấu hình các đường kẻ dọc (Annotation) cho T0 và T1
    const annotations = {};
    if (T0 !== null) {
        annotations.lineT0 = {
            type: 'line',
            xMin: T0,
            xMax: T0,
            borderColor: '#ef4444',
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
                display: true,
                content: 'T0 Onset',
                position: 'start',
                backgroundColor: '#ef4444',
                color: '#fff',
                font: { size: 10 }
            }
        };
    }
    annotations.lineT1 = {
        type: 'line',
        xMin: T1,
        xMax: T1,
        borderColor: '#10b981',
        borderWidth: 2,
        label: {
            display: true,
            content: 'T1 Peak',
            position: 'start',
            backgroundColor: '#10b981',
            color: '#fff',
            font: { size: 10 }
        }
    };

    fzChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Fz Total (N)',
                data: data,
                borderColor: '#2563eb',
                borderWidth: 1.2,
                pointRadius: 0,
                fill: false,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: 'Thời gian (s)' },
                    grid: { color: '#e2e8f0' }
                },
                y: {
                    title: { display: true, text: 'Lực Fz (Newton)' },
                    grid: { color: '#e2e8f0' }
                }
            },
            plugins: {
                legend: { display: false },
                annotation: { annotations: annotations }
            }
        }
    });
}
