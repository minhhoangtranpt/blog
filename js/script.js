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

        // --- CHỈ ĐỌC DỮ LIỆU ĐẾN 10 GIÂY ---
        for (let i = dataStartIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split('\t');
            const t = parseFloat(cols[0]);
            const fz = parseFloat(cols[1]); 

            if (!isNaN(t) && !isNaN(fz)) {
                if (t > 10.0) break; // Ngắt ngay lập tức khi thời gian vượt qua 10.0s
                timeData.push(t);
                fzData.push(fz);
            }
        }

        if (timeData.length < 2) return;

        try {
            // --- 1. BASELINE VÀ ĐỘ LỆCH CHUẨN (0 - 5s) ---
            const fz5s = fzData.filter((_, idx) => timeData[idx] <= 5.0);
            const meanFz5s = jStat.mean(fz5s);
            const stdFz5s = jStat.stdev(fz5s);
            const thresholdT0 = meanFz5s - (4 * stdFz5s);

            let T0_val = null, T0_idx = -1, fzAtT0 = null;
            let T1_val = null, T1_idx = -1, fzAtT1 = null;
            let T2_val = null, T2_idx = -1, fzAtT2 = null;
            let T3_val = null, T3_idx = -1, fzAtT3 = null;
            let T4_val = null, T4_idx = -1, fzAtT4 = null;
            let T5_val = null, T5_idx = -1, fzAtT5 = null;

            const sampleRate = 1 / (timeData[1] - timeData[0]);
            const windowMs = parseInt(windowMsInput ? windowMsInput.value : 20) || 20;
            const windowSize = Math.ceil((windowMs / 1000) * sampleRate);

            // --- T0: Giảm quá 4 SD ---
            for (let i = 0; i < timeData.length - windowSize; i++) {
                let isStable = true;
                for (let j = 0; j < windowSize; j++) {
                    if (fzData[i + j] >= thresholdT0) {
                        isStable = false; break;
                    }
                }
                if (isStable) {
                    T0_val = timeData[i]; T0_idx = i; fzAtT0 = fzData[i];
                    break;
                }
            }

            // --- T1: Phục hồi bằng Fz của T0 ---
            if (T0_idx !== -1) {
                for (let i = T0_idx + 1; i < timeData.length; i++) {
                    if (fzData[i] >= fzAtT0) {
                        T1_val = timeData[i]; T1_idx = i; fzAtT1 = fzData[i];
                        break;
                    }
                }
            }

            // --- T2: Cực đại (Từ T1 trở đi) ---
            let searchStartT2 = (T1_idx !== -1) ? T1_idx : ((T0_idx !== -1) ? T0_idx : 0);
            let maxFz = -Infinity;
            for (let i = searchStartT2; i < timeData.length; i++) {
                if (fzData[i] > maxFz) {
                    maxFz = fzData[i];
                    T2_val = timeData[i]; T2_idx = i; fzAtT2 = fzData[i];
                }
            }

            // --- T4: Cực tiểu (Từ T2 trở đi) ---
            if (T2_idx !== -1) {
                let minFz = Infinity;
                for (let i = T2_idx; i < timeData.length; i++) {
                    if (fzData[i] < minFz) {
                        minFz = fzData[i];
                        T4_val = timeData[i]; T4_idx = i; fzAtT4 = fzData[i];
                    }
                }
            }

            // --- T3 & T5: Vùng chênh lệch tối thiểu ---
            const stableMs = 500; 
            const stableW = Math.ceil((stableMs / 1000) * sampleRate);

            function findStableRegion(startIdx, endIdx) {
                if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) return null;
                if ((endIdx - startIdx) < stableW) {
                    let mid = Math.floor((startIdx + endIdx) / 2);
                    return { idx: mid, val: timeData[mid], fz: fzData[mid] };
                }
                
                let minDiff = Infinity;
                let bestIdx = startIdx;
                let bestMean = 0;

                for (let i = startIdx; i <= endIdx - stableW; i++) {
                    let maxW = -Infinity, minW = Infinity;
                    let sumW = 0;
                    for (let j = 0; j < stableW; j++) {
                        let v = fzData[i + j];
                        if (v > maxW) maxW = v;
                        if (v < minW) minW = v;
                        sumW += v;
                    }
                    if ((maxW - minW) < minDiff) {
                        minDiff = maxW - minW;
                        bestIdx = i + Math.floor(stableW / 2);
                        bestMean = sumW / stableW;
                    }
                }
                return { idx: bestIdx, val: timeData[bestIdx], fz: bestMean };
            }

            // T3: Tìm giữa T2 và T4
            if (T2_idx !== -1 && T4_idx !== -1) {
                let t3Data = findStableRegion(T2_idx, T4_idx);
                if(t3Data) { T3_val = t3Data.val; fzAtT3 = t3Data.fz; }
            }

            // T5: Tìm từ T4 đến cuối đoạn dữ liệu (tối đa là mốc 10.0s)
            if (T4_idx !== -1) {
                let t5Data = findStableRegion(T4_idx, timeData.length - 1);
                if(t5Data) { T5_val = t5Data.val; fzAtT5 = t5Data.fz; }
            }

            // --- HIỂN THỊ HTML ---
            chartWrapper.style.display = 'block'; 
            resultDiv.innerHTML = `
                <div class="card card-full animate">
                    <h3>Thông số Baseline (0 - 5.0s)</h3>
                    <div class="value">${meanFz5s.toFixed(2)}<span class="unit">N</span></div>
                    <div class="info-footer">Ngưỡng T0 (-4 SD): <b>${thresholdT0.toFixed(2)} N</b></div>
                </div>
                <div class="card animate" style="border-top: 4px solid #ef4444;">
                    <h3>T0 (Khởi phát)</h3>
                    <div class="value" style="color: #ef4444;">${T0_val !== null ? T0_val.toFixed(4) : "---"}</div>
                    <div class="info-footer">Fz: ${fzAtT0 !== null ? fzAtT0.toFixed(2) : "---"} N</div>
                </div>
                <div class="card animate" style="border-top: 4px solid #10b981;">
                    <h3>T1 (Phục hồi)</h3>
                    <div class="value" style="color: #10b981;">${T1_val !== null ? T1_val.toFixed(4) : "---"}</div>
                    <div class="info-footer">Fz: ${fzAtT1 !== null ? fzAtT1.toFixed(2) : "---"} N</div>
                </div>
                <div class="card animate" style="border-top: 4px solid #f59e0b;">
                    <h3>T2 (Cực đại)</h3>
                    <div class="value" style="color: #f59e0b;">${T2_val !== null ? T2_val.toFixed(4) : "---"}</div>
                    <div class="info-footer">Fz Peak: ${fzAtT2 !== null ? fzAtT2.toFixed(2) : "---"} N</div>
                </div>
                <div class="card animate" style="border-top: 4px solid #3b82f6;">
                    <h3>T3 (Ổn định 1)</h3>
                    <div class="value" style="color: #3b82f6;">${T3_val !== null ? T3_val.toFixed(4) : "---"}</div>
                    <div class="info-footer">Fz TB: ${fzAtT3 !== null ? fzAtT3.toFixed(2) : "---"} N</div>
                </div>
                <div class="card animate" style="border-top: 4px solid #8b5cf6;">
                    <h3>T4 (Cực tiểu)</h3>
                    <div class="value" style="color: #8b5cf6;">${T4_val !== null ? T4_val.toFixed(4) : "---"}</div>
                    <div class="info-footer">Fz Min: ${fzAtT4 !== null ? fzAtT4.toFixed(2) : "---"} N</div>
                </div>
                <div class="card animate" style="border-top: 4px solid #64748b;">
                    <h3>T5 (Ổn định 2)</h3>
                    <div class="value" style="color: #64748b;">${T5_val !== null ? T5_val.toFixed(4) : "---"}</div>
                    <div class="info-footer">Fz TB: ${fzAtT5 !== null ? fzAtT5.toFixed(2) : "---"} N</div>
                </div>
            `;

            drawChart(timeData, fzData, T0_val, T1_val, T2_val, T3_val, T4_val, T5_val);

        } catch (err) {
            console.error(err);
            alert("Lỗi tính toán: " + err.message);
        }
    };

    reader.readAsText(file);
}

function drawChart(labels, data, T0, T1, T2, T3, T4, T5) {
    const ctx = document.getElementById('fzChart').getContext('2d');
    if (fzChartInstance) fzChartInstance.destroy();

    const annotations = {};
    
    function addLine(id, value, color, text) {
        if (value !== null) {
            annotations[id] = {
                type: 'line', xMin: value, xMax: value,
                borderColor: color, borderWidth: 2, borderDash: [4, 4],
                label: {
                    display: true, content: text, position: 'start',
                    backgroundColor: color, color: '#fff', font: { size: 10 }
                }
            };
        }
    }

    addLine('l0', T0, '#ef4444', 'T0');
    addLine('l1', T1, '#10b981', 'T1');
    addLine('l2', T2, '#f59e0b', 'T2');
    addLine('l3', T3, '#3b82f6', 'T3');
    addLine('l4', T4, '#8b5cf6', 'T4');
    addLine('l5', T5, '#64748b', 'T5');

    fzChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Fz Total (N)', data: data,
                borderColor: '#2563eb', borderWidth: 1.2, pointRadius: 0, fill: false, tension: 0.1
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { type: 'linear', title: { display: true, text: 'Thời gian (s)' }, max: 10.0 }, // Cố định hiển thị trục X tối đa 10s
                y: { title: { display: true, text: 'Lực Fz (N)' } }
            },
            plugins: {
                legend: { display: false },
                annotation: { annotations: annotations }
            }
        }
    });
}
