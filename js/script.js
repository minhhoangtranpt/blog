let fzChartInstance = null;

function processFile() {
    const fileInput = document.getElementById('fileInput');
    const resultDiv = document.getElementById('result');
    const windowMsInput = document.getElementById('windowMs');
    const chartWrapper = document.getElementById('chartWrapper');
    
    if (!fileInput.files.length) {
        alert("Vui lòng chọn file dữ liệu!");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        const lines = e.target.result.split(/\r?\n/);
        let dataStartIndex = -1;

        // 1. Tìm dòng bắt đầu dữ liệu (Skip header)
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes("Time (s)")) {
                dataStartIndex = (lines[i+1] && lines[i+1].includes("TOTAL")) ? i + 2 : i + 1;
                break;
            }
        }

        if (dataStartIndex === -1) {
            alert("Định dạng file không đúng!");
            return;
        }

        let timeData = [];
        let fzData = [];

        for (let i = dataStartIndex; i < lines.length; i++) {
            const cols = lines[i].trim().split('\t');
            if (cols.length < 2) continue;
            const t = parseFloat(cols[0]);
            const fz = parseFloat(cols[1]);
            if (!isNaN(t) && !isNaN(fz)) {
                timeData.push(t);
                fzData.push(fz);
            }
        }

        // --- TÍNH TOÁN LOGIC MỚI ---

        // BƯỚC A: Tính Baseline từ 5 giây đầu
        const fz5s = fzData.filter((_, idx) => timeData[idx] <= 5.0);
        const meanFz5s = jStat.mean(fz5s);
        
        // Ngưỡng T0: 2.5% của lực trung bình tĩnh
        const thresholdT0 = 0.025 * meanFz5s;

        // BƯỚC B: Tìm T1 (Điểm CỰC ĐẠI) trước để làm mốc chặn
        let maxFz = -Infinity;
        let T1_idx = -1;
        // Chỉ tìm trong 10 giây đầu theo yêu cầu nghiên cứu
        for (let i = 0; i < timeData.length; i++) {
            if (timeData[i] > 10.0) break; 
            if (fzData[i] > maxFz) {
                maxFz = fzData[i];
                T1_idx = i;
            }
        }
        const T1 = timeData[T1_idx];

        // BƯỚC C: Tìm T0 (Điểm KHỞI PHÁT) - CHỈ QUÉT TRƯỚC T1
        const sampleRate = 1 / (timeData[1] - timeData[0]);
        const windowSize = Math.ceil((windowMsInput.value / 1000) * sampleRate);
        let T0_val = null;

        // QUAN TRỌNG: i chỉ chạy đến T1_idx - windowSize
        for (let i = 0; i <= T1_idx - windowSize; i++) {
            let isStableBelow = true;
            for (let j = 0; j < windowSize; j++) {
                if (fzData[i + j] >= thresholdT0) {
                    isStableBelow = false;
                    break;
                }
            }
            if (isStableBelow) {
                T0_val = timeData[i];
                break; // Tìm thấy điểm đầu tiên thỏa mãn TRƯỚC T1 thì dừng ngay
            }
        }

        // --- HIỂN THỊ KẾT QUẢ ---
        chartWrapper.style.display = 'block';
        resultDiv.innerHTML = `
            <div class="card card-full animate">
                <h3>Lực Baseline (0-5s)</h3>
                <div class="value">${meanFz5s.toFixed(2)}<span class="unit">N</span></div>
                <div class="info-footer">Ngưỡng T0 xác định tại: ${thresholdT0.toFixed(2)} N</div>
            </div>
            <div class="card danger-border animate">
                <h3>Mốc T0 (Khởi phát)</h3>
                <div class="value" style="color: var(--danger);">${T0_val !== null ? T0_val.toFixed(4) : "---"}</div>
                <div class="unit">giây</div>
                <div class="info-footer">Trạng thái: ${T0_val !== null ? "Hợp lệ (Trước T1)" : "Không tìm thấy trước T1"}</div>
            </div>
            <div class="card success-border animate">
                <h3>Mốc T1 (Cực đại)</h3>
                <div class="value" style="color: var(--success);">${T1.toFixed(4)}</div>
                <div class="unit">giây</div>
                <div class="info-footer">Đỉnh lực: ${maxFz.toFixed(2)} N</div>
            </div>
        `;

        drawChart(timeData, fzData, T0_val, T1);
    };
    reader.readAsText(file);
}

function drawChart(labels, data, T0, T1) {
    const ctx = document.getElementById('fzChart').getContext('2d');
    if (fzChartInstance) fzChartInstance.destroy();

    const annotations = {};
    if (T0 !== null) {
        annotations.lineT0 = {
            type: 'line', xMin: T0, xMax: T0,
            borderColor: '#ef4444', borderWidth: 2,
            label: { display: true, content: 'T0', position: 'start', backgroundColor: '#ef4444', color: '#fff' }
        };
    }
    annotations.lineT1 = {
        type: 'line', xMin: T1, xMax: T1,
        borderColor: '#10b981', borderWidth: 2,
        label: { display: true, content: 'T1', position: 'start', backgroundColor: '#10b981', color: '#fff' }
    };

    fzChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Fz Total',
                data: data,
                borderColor: '#2563eb',
                borderWidth: 1.2,
                pointRadius: 0,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { type: 'linear', title: { display: true, text: 'Thời gian (s)' } },
                y: { title: { display: true, text: 'Lực (N)' } }
            },
            plugins: {
                legend: { display: false },
                annotation: { annotations: annotations }
            }
        }
    });
}
