let fzChartInstance = null;

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
        
        let dataStartIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes("Time (s)")) {
                dataStartIndex = (lines[i+1] && lines[i+1].includes("TOTAL")) ? i + 2 : i + 1;
                break;
            }
        }

        if (dataStartIndex === -1) {
            alert("Lỗi: Không tìm thấy định dạng dữ liệu TwinPlates chuẩn.");
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

        if (timeData.length < 2) {
            alert("Lỗi: File không chứa đủ dữ liệu số.");
            return;
        }

        try {
            // --- 1. TÍNH BASELINE & ĐỘ LỆCH CHUẨN (0-5s) ---
            const fz5s = fzData.filter((_, idx) => timeData[idx] <= 5.0);
            const meanFz5s = jStat.mean(fz5s);
            const stdFz5s = jStat.stdev(fz5s);

            // --- 2. XÁC ĐỊNH NGƯỠNG T0 (Mean - 4*SD) ---
            const thresholdT0 = meanFz5s - (4 * stdFz5s);

            // --- 3. TÌM T0 (Giảm quá 4 SD) ---
            const sampleRate = 1 / (timeData[1] - timeData[0]);
            const windowMs = parseInt(windowMsInput.value) || 20;
            const windowSize = Math.ceil((windowMs / 1000) * sampleRate);
            
            let T0_val = null;
            let T0_idx = -1;
            let fzAtT0 = null;

            for (let i = 0; i < timeData.length - windowSize; i++) {
                let isStableMovement = true;
                for (let j = 0; j < windowSize; j++) {
                    if (fzData[i + j] >= thresholdT0) {
                        isStableMovement = false;
                        break;
                    }
                }
                if (isStableMovement) {
                    T0_val = timeData[i];
                    T0_idx = i;
                    fzAtT0 = fzData[i]; // Lưu lại giá trị Fz tại mốc T0
                    break;
                }
            }

            // --- 4. TÌM T1 (Phục hồi bằng Fz của T0) ---
            let T1_val = null;
            let fzAtT1 = null;

            if (T0_idx !== -1) {
                // Chỉ tìm T1 BẮT ĐẦU TỪ sau T0
                for (let i = T0_idx + 1; i < timeData.length; i++) {
                    // Khi Fz tăng trở lại và chạm/vượt mức Fz của T0
                    if (fzData[i] >= fzAtT0) {
                        T1_val = timeData[i];
                        fzAtT1 = fzData[i];
                        break;
                    }
                }
            }

            // --- 5. HIỂN THỊ KẾT QUẢ ---
            chartWrapper.style.display = 'block'; 
            resultDiv.innerHTML = `
                <div class="card card-full animate">
                    <h3>Thông số Baseline (0 - 5.0s)</h3>
                    <div class="value">${meanFz5s.toFixed(2)}<span class="unit">N</span></div>
                    <div class="info-footer">
                        SD: ${stdFz5s.toFixed(2)} N | Ngưỡng T0 (-4 SD): <b>${thresholdT0.toFixed(2)} N</b>
                    </div>
                </div>
                
                <div class="card danger-border animate">
                    <h3>Mốc T0 (Bắt đầu)</h3>
                    <div class="value" style="color: var(--danger);">${T0_val !== null ? T0_val.toFixed(4) : "---"}</div>
                    <div class="unit">giây</div>
                    <div class="info-footer">Fz tại T0: ${fzAtT0 !== null ? fzAtT0.toFixed(2) + " N" : "---"}</div>
                </div>

                <div class="card success-border animate">
                    <h3>Mốc T1 (Phục hồi)</h3>
                    <div class="value" style="color: var(--success);">${T1_val !== null ? T1_val.toFixed(4) : "---"}</div>
                    <div class="unit">giây</div>
                    <div class="info-footer">Fz tại T1: ${fzAtT1 !== null ? fzAtT1.toFixed(2) + " N" : "---"}</div>
                </div>
            `;

            drawChart(timeData, fzData, T0_val, T1_val);

        } catch (err) {
            console.error("Lỗi trong quá trình xử lý:", err);
            alert("Có lỗi xảy ra khi tính toán dữ liệu số.");
        }
    };

    reader.readAsText(file);
}

function drawChart(labels, data, T0, T1) {
    const ctx = document.getElementById('fzChart').getContext('2d');
    
    if (fzChartInstance) {
        fzChartInstance.destroy();
    }

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
                content: 'T0 (Onset)',
                position: 'start',
                backgroundColor: '#ef4444',
                color: '#fff',
                font: { size: 10 }
            }
        };
    }
    if (T1 !== null) {
        annotations.lineT1 = {
            type: 'line',
            xMin: T1,
            xMax: T1,
            borderColor: '#10b981',
            borderWidth: 2,
            label: {
                display: true,
                content: 'T1 (Recovery)',
                position: 'start',
                backgroundColor: '#10b981',
                color: '#fff',
                font: { size: 10 }
            }
        };
    }

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
                    title: { display: true, text: 'Lực Fz (N)' },
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
