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

        // Đọc TOÀN BỘ dữ liệu để vẽ biểu đồ
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

        if (timeData.length < 2) return;

        try {
            // --- TẠO MỐC CHẶN 10 GIÂY ---
            let limitIdx = timeData.findIndex(t => t > 10.0);
            if (limitIdx === -1) limitIdx = timeData.length; 

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
            
            // Các biến trung gian để vẽ biểu đồ
            let localMax_val = null;
            let localMin_val = null;

            const sampleRate = 1 / (timeData[1] - timeData[0]);
            const windowMs = parseInt(windowMsInput ? windowMsInput.value : 20) || 20;
            const windowSize = Math.ceil((windowMs / 1000) * sampleRate);

            // --- T0: Giảm quá 4 SD ---
            for (let i = 0; i < limitIdx - windowSize; i++) {
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
                for (let i = T0_idx + 1; i < limitIdx; i++) {
                    if (fzData[i] >= fzAtT0) {
                        T1_val = timeData[i]; T1_idx = i; fzAtT1 = fzData[i];
                        break;
                    }
                }
            }

            // --- T2: Cực đại (Từ T1 trở đi) ---
            let searchStartT2 = (T1_idx !== -1) ? T1_idx : ((T0_idx !== -1) ? T0_idx : 0);
            let maxFz = -Infinity;
            for (let i = searchStartT2; i < limitIdx; i++) {
                if (fzData[i] > maxFz) {
                    maxFz = fzData[i];
                    T2_val = timeData[i]; T2_idx = i; fzAtT2 = fzData[i];
                }
            }

            // --- T4: Cực tiểu (Từ T2 trở đi) ---
            if (T2_idx !== -1) {
                let minFz = Infinity;
                for (let i = T2_idx; i < limitIdx; i++) {
                    if (fzData[i] < minFz) {
                        minFz = fzData[i];
                        T4_val = timeData[i]; T4_idx = i; fzAtT4 = fzData[i];
                    }
                }
            }

            // --- T3: Vùng chênh lệch tối thiểu (Giữa T2 và T4) ---
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

            if (T2_idx !== -1 && T4_idx !== -1) {
                let t3Data = findStableRegion(T2_idx, T4_idx);
                if(t3Data) { T3_val = t3Data.val; T3_idx = t3Data.idx; fzAtT3 = t3Data.fz; }
            }

            // --- CHUỖI TÌM KIẾM T5 THEO ĐÚNG THỨ TỰ ---
            // T4 -> Cực đại cục bộ (trong 1s) -> Cực tiểu cục bộ -> T5
            if (T4_idx !== -1 && fzAtT3 !== null) {
                const maxTimeWindow = timeData[T4_idx] + 1.0; 
                let endWindowIdx = T4_idx;
                while (endWindowIdx < limitIdx && timeData[endWindowIdx] <= maxTimeWindow) {
                    endWindowIdx++;
                }

                // 1. Tìm CỰC ĐẠI cục bộ (trong 1 giây sau T4)
                let lMaxIdx = T4_idx;
                let lMaxFz = fzData[T4_idx];
                for (let i = T4_idx + 1; i < endWindowIdx; i++) {
                    if (fzData[i] > lMaxFz) {
                        lMaxFz = fzData[i];
                        lMaxIdx = i;
                    }
                }
                localMax_val = timeData[lMaxIdx];

                // 2. Tìm CỰC TIỂU cục bộ (Từ sau cực đại cục bộ đến hết 1 giây)
                let lMinIdx = lMaxIdx;
                let lMinFz = fzData[lMaxIdx];
                for (let i = lMaxIdx + 1; i < endWindowIdx; i++) {
                    if (fzData[i] < lMinFz) {
                        lMinFz = fzData[i];
                        lMinIdx = i;
                    }
                }
                localMin_val = timeData[lMinIdx];

                // 3. Tìm T5 (Từ sau cực tiểu cục bộ kéo dài đến giới hạn 10s)
                for (let i = lMinIdx + 1; i < limitIdx; i++) {
                    if (fzData[i] >= fzAtT3) {
                        T5_val = timeData[i];
                        T5_idx = i;
                        fzAtT5 = fzData[i];
                        break; 
                    }
                }
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
                    <h3>T5 (Phục hồi cuối)</h3>
                    <div class="value" style="color: #64748b;">${T5_val !== null ? T5_val.toFixed(4) : "---"}</div>
                    <div class="info-footer">${T5_val !== null ? `Fz: ${fzAtT5.toFixed(2)} N` : "Không tìm thấy sau cực tiểu"}</div>
                </div>
            `;

            // Gọi hàm vẽ, truyền thêm các điểm phụ để chú thích
            drawChart(timeData, fzData, T0_val, T1_val, T2_val, T3_val, T4_val, T5_val, localMax_val, localMin_val);

        } catch (err) {
            console.error(err);
            alert("Lỗi tính toán: " + err.message);
        }
    };

    reader.readAsText(file);
}

// Cập nhật hàm drawChart để nhận thêm 2 biến phụ
function drawChart(labels, data, T0, T1, T2, T3, T4, T5, lMax, lMin) {
    const ctx = document.getElementById('fzChart').getContext('2d');
    if (fzChartInstance) fzChartInstance.destroy();

    const annotations = {};
    
    // Hàm vẽ đường kẻ chính
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

    // Hàm vẽ đường kẻ mờ cho các mốc trung gian
    function addThinLine(id, value, text) {
        if (value !== null && value !== T4 && value !== T5) {
            annotations[id] = {
                type: 'line', xMin: value, xMax: value,
                borderColor: '#94a3b8', borderWidth: 1, borderDash: [2, 2],
                label: {
                    display: true, content: text, position: 'end',
                    backgroundColor: 'rgba(148, 163, 184, 0.8)', color: '#fff', font: { size: 9 }
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
    
    // Vẽ thêm 2 mốc trung gian lên biểu đồ để bạn dễ theo dõi logic
    addThinLine('lMax', lMax, 'C.Đại phụ');
    addThinLine('lMin', lMin, 'C.Tiểu phụ');

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
                x: { type: 'linear', title: { display: true, text: 'Thời gian (s)' } },
                y: { title: { display: true, text: 'Lực Fz (N)' } }
            },
            plugins: {
                legend: { display: false },
                annotation: { annotations: annotations }
            }
        }
    });
}
