let fzChartInstance = null;

function processFile() {
    const fileInput = document.getElementById('fileInput');
    const analysisMode = document.getElementById('analysisMode').value;
    
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
        let subjectWeight = null;
        
        // Quét header để tìm Subject weight và vị trí bắt đầu của dữ liệu
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes("Subject weight (kg)")) {
                const parts = lines[i].split('\t');
                if (parts.length > 1) {
                    subjectWeight = parseFloat(parts[1]);
                }
            }
            if (lines[i].includes("Time (s)")) {
                dataStartIndex = (lines[i+1] && lines[i+1].includes("TOTAL")) ? i + 2 : i + 1;
                break;
            }
        }

        if (dataStartIndex === -1) {
            alert("Lỗi: Không tìm thấy định dạng dữ liệu chuẩn.");
            return;
        }

        let timeData = [];
        let fzData = [];
        let fzAData = []; // Lưu lực bàn A
        let fzBData = []; // Lưu lực bàn B

        for (let i = dataStartIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split('\t');
            
            const t = parseFloat(cols[0]);
            const fz = parseFloat(cols[1]); // Fz Total
            const fzA = parseFloat(cols[14]); // Fz Forceplate A
            const fzB = parseFloat(cols[23]); // Fz Forceplate B

            if (!isNaN(t) && !isNaN(fz)) {
                timeData.push(t);
                fzData.push(fz);
                fzAData.push(isNaN(fzA) ? 0 : fzA);
                fzBData.push(isNaN(fzB) ? 0 : fzB);
            }
        }

        if (timeData.length < 2) return;

        if (analysisMode === 'sts') {
            analyzeSTS(timeData, fzData, fzAData, fzBData);
        } else if (analysisMode === 'stw') {
            analyzeSTW(timeData, fzData, fzAData, fzBData, subjectWeight);
        }
    };

    reader.readAsText(file);
}

// ==========================================
// BÀI TEST 1: SIT TO STAND (STS)
// ==========================================
function analyzeSTS(timeData, fzData, fzAData, fzBData) {
    const resultDiv = document.getElementById('result');
    const windowMsInput = document.getElementById('windowMs');
    const chartWrapper = document.getElementById('chartWrapper');

    try {
        let limitIdx = timeData.findIndex(t => t > 15.0);
        if (limitIdx === -1) limitIdx = timeData.length; 

        const fz5s = fzData.filter((_, idx) => timeData[idx] <= 5.0);
        const meanFz5s = jStat.mean(fz5s);
        const stdFz5s = jStat.stdev(fz5s);
        const thresholdT0 = meanFz5s - (3 * stdFz5s);

        let T0_val = null, T0_idx = -1, fzAtT0 = null;
        let T1_val = null, T1_idx = -1, fzAtT1 = null;
        let T2_val = null, T2_idx = -1, fzAtT2 = null;
        let T3_val = null, T3_idx = -1, fzAtT3 = null;
        let T4_val = null, T4_idx = -1, fzAtT4 = null;
        let T5_val = null, T5_idx = -1, fzAtT5 = null;
        
        let localMax_val = null, localMin_val = null;
        let lMaxFz = null; 
        let lMaxIdx = -1; 

        const sampleRate = 1 / (timeData[1] - timeData[0]);
        const windowMs = parseInt(windowMsInput ? windowMsInput.value : 20) || 20;
        const windowSize = Math.ceil((windowMs / 1000) * sampleRate);

        for (let i = 0; i < limitIdx - windowSize; i++) {
            let isStable = true;
            for (let j = 0; j < windowSize; j++) {
                if (fzData[i + j] >= thresholdT0) { isStable = false; break; }
            }
            if (isStable) { T0_val = timeData[i]; T0_idx = i; fzAtT0 = fzData[i]; break; }
        }

        if (T0_idx !== -1) {
            for (let i = T0_idx + 1; i < limitIdx; i++) {
                if (fzData[i] >= fzAtT0) { T1_val = timeData[i]; T1_idx = i; fzAtT1 = fzData[i]; break; }
            }
        }

        let searchStartT2 = (T1_idx !== -1) ? T1_idx : ((T0_idx !== -1) ? T0_idx : 0);
        let maxFz = -Infinity;
        for (let i = searchStartT2; i < limitIdx; i++) {
            if (fzData[i] > maxFz) { maxFz = fzData[i]; T2_val = timeData[i]; T2_idx = i; fzAtT2 = fzData[i]; }
        }

        if (T2_idx !== -1) {
            let minFz = Infinity;
            for (let i = T2_idx; i < limitIdx; i++) {
                if (fzData[i] < minFz) { minFz = fzData[i]; T4_val = timeData[i]; T4_idx = i; fzAtT4 = fzData[i]; }
            }
        }

        if (T4_idx !== -1) {
            const maxTimeWindow = timeData[T4_idx] + 0.5; 
            let endWindowIdx = T4_idx;
            while (endWindowIdx < limitIdx && timeData[endWindowIdx] <= maxTimeWindow) { endWindowIdx++; }

            lMaxIdx = T4_idx; 
            lMaxFz = fzData[T4_idx];
            for (let i = T4_idx + 1; i < endWindowIdx; i++) {
                if (fzData[i] > lMaxFz) { lMaxFz = fzData[i]; lMaxIdx = i; }
            }
            localMax_val = timeData[lMaxIdx];

            let lMinIdx = lMaxIdx, lMinFz = fzData[lMaxIdx];
            for (let i = lMaxIdx + 1; i < endWindowIdx; i++) {
                if (fzData[i] < lMinFz) { lMinFz = fzData[i]; lMinIdx = i; }
            }
            localMin_val = timeData[lMinIdx];
        }

        const stableMs = 500; 
        const stableW = Math.ceil((stableMs / 1000) * sampleRate);
        let idx9s = timeData.findIndex(t => t >= 9.0);
        let idx14s = timeData.findIndex(t => t >= 14.0);
        if (idx14s === -1) idx14s = timeData.length - 1;

        let refStableFz = null;
        if (idx9s !== -1 && idx9s < idx14s && (idx14s - idx9s >= stableW)) {
            let minDiff = Infinity;
            for (let i = idx9s; i <= idx14s - stableW; i++) {
                let maxW = -Infinity, minW = Infinity, sumW = 0;
                for (let j = 0; j < stableW; j++) {
                    let v = fzData[i + j];
                    if (v > maxW) maxW = v; if (v < minW) minW = v; sumW += v;
                }
                if ((maxW - minW) < minDiff) {
                    minDiff = maxW - minW; refStableFz = sumW / stableW; 
                }
            }
        }

        if (T2_idx !== -1 && T4_idx !== -1 && refStableFz !== null) {
            for (let i = T4_idx; i >= T2_idx; i--) {
                if (fzData[i] >= refStableFz) {
                    T3_idx = i; T3_val = timeData[i]; fzAtT3 = fzData[i]; break;
                }
            }
        }

        // [MỚI CẬP NHẬT] T5: Điểm chạm hoặc vượt qua Fz T3, lấy điểm gần ngay sau T4 nhất
        if (T4_idx !== -1 && fzAtT3 !== null) {
            for (let i = T4_idx + 1; i < limitIdx; i++) {
                if (fzData[i] >= fzAtT3) { 
                    T5_val = timeData[i]; T5_idx = i; fzAtT5 = fzData[i]; break; 
                }
            }
        }

        chartWrapper.style.display = 'block'; 
        resultDiv.innerHTML = `
            <div class="card card-full animate">
                <h3>Baseline STS (0 - 5.0s)</h3>
                <div class="value">${meanFz5s.toFixed(2)}<span class="unit">N</span></div>
                <div class="info-footer">Ngưỡng T0: <b>${thresholdT0.toFixed(2)} N</b></div>
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
                <div class="info-footer">Fz Ref (9-14s): ${refStableFz !== null ? refStableFz.toFixed(2) : "---"} N</div>
            </div>
            <div class="card animate" style="border-top: 4px solid #8b5cf6;">
                <h3>T4 (Cực tiểu)</h3>
                <div class="value" style="color: #8b5cf6;">${T4_val !== null ? T4_val.toFixed(4) : "---"}</div>
                <div class="info-footer">Fz Min: ${fzAtT4 !== null ? fzAtT4.toFixed(2) : "---"} N</div>
            </div>
            <div class="card animate" style="border-top: 4px solid #64748b;">
                <h3>T5 (Chạm mức T3)</h3>
                <div class="value" style="color: #64748b;">${T5_val !== null ? T5_val.toFixed(4) : "---"}</div>
                <div class="info-footer">${T5_val !== null ? `Fz: ${fzAtT5.toFixed(2)} N` : "Không tìm thấy sau T4"}</div>
            </div>
        `;
        
        drawChart(timeData, fzData, fzAData, fzBData, T0_val, T1_val, T2_val, T3_val, T4_val, T5_val, localMax_val, localMin_val);

    } catch (err) {
        console.error(err); alert("Lỗi phân tích STS: " + err.message);
    }
}

// ==========================================
// BÀI TEST 2: SIT TO WALK (STW)
// ==========================================
function analyzeSTW(timeData, fzData, fzAData, fzBData, subjectWeight) {
    const resultDiv = document.getElementById('result');
    const windowMsInput = document.getElementById('windowMs');
    const chartWrapper = document.getElementById('chartWrapper');

    try {
        let limitIdx = timeData.findIndex(t => t > 15.0);
        if (limitIdx === -1) limitIdx = timeData.length; 

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

        // 1. T0
        for (let i = 0; i < limitIdx - windowSize; i++) {
            let isStable = true;
            for (let j = 0; j < windowSize; j++) {
                if (fzData[i + j] >= thresholdT0) { isStable = false; break; }
            }
            if (isStable) { T0_val = timeData[i]; T0_idx = i; fzAtT0 = fzData[i]; break; }
        }

        // 2. T1
        if (T0_idx !== -1) {
            for (let i = T0_idx + 1; i < limitIdx; i++) {
                if (fzData[i] >= fzAtT0) { T1_val = timeData[i]; T1_idx = i; fzAtT1 = fzData[i]; break; }
            }
        }

        // 3. T2 (Cực đại chính)
        let searchStartT2 = (T1_idx !== -1) ? T1_idx : ((T0_idx !== -1) ? T0_idx : 0);
        let maxFz = -Infinity;
        for (let i = searchStartT2; i < limitIdx; i++) {
            if (fzData[i] > maxFz) { maxFz = fzData[i]; T2_val = timeData[i]; T2_idx = i; fzAtT2 = fzData[i]; }
        }

        // 4. T3: Khi Fz total = Subject weight x 9.81 ngay gần nhất sau T2
        let refStableFz = null;
        let refStableLabel = "---";
        
        if (subjectWeight !== null && !isNaN(subjectWeight)) {
            refStableFz = subjectWeight * 9.81; 
            refStableLabel = `${refStableFz.toFixed(2)} N (${subjectWeight}kg)`;
        } else {
            refStableFz = meanFz5s; 
            refStableLabel = `${refStableFz.toFixed(2)} N (Dự phòng 5s)`;
        }

        if (T2_idx !== -1 && refStableFz !== null) {
            for (let i = T2_idx + 1; i < limitIdx; i++) {
                if (fzData[i] <= refStableFz) { 
                    T3_idx = i;
                    T3_val = timeData[i];
                    fzAtT3 = fzData[i];
                    break;
                }
            }
        }

        // 5. T4: TÌM T4 TRƯỚC T5
        // Fz của 1 bên forceplate bất kỳ (A hoặc B) < 5% Subject weight duy trì trong 50ms
        const window50 = Math.ceil((50 / 1000) * sampleRate);
        let footOffAtT4 = null; // Ghi nhớ chân nào nhấc ở T4 ('A' hoặc 'B')

        if (T3_idx !== -1 && refStableFz !== null) {
            const thresholdT4 = 0.05 * refStableFz; 
            const searchEnd = timeData.length; 

            for (let i = T3_idx; i <= searchEnd - window50; i++) {
                let isStableA = true;
                let isStableB = true;
                
                for (let j = 0; j < window50; j++) {
                    if (fzAData[i + j] >= thresholdT4) isStableA = false;
                    if (fzBData[i + j] >= thresholdT4) isStableB = false;
                    
                    if (!isStableA && !isStableB) break;
                }
                
                if (isStableA || isStableB) {
                    T4_idx = i;
                    T4_val = timeData[i];
                    fzAtT4 = fzData[i]; 
                    footOffAtT4 = isStableA ? 'A' : 'B';
                    break;
                }
            }
        }

        // 6. T5: CHÂN CÒN LẠI rời bàn lực (Fz chân còn lại <= 5N)
        if (T4_idx !== -1 && footOffAtT4 !== null) {
            for (let i = T4_idx; i < timeData.length; i++) {
                // Xác định lực của chân chưa nhấc ở T4
                let fzRemainingFoot = (footOffAtT4 === 'A') ? fzBData[i] : fzAData[i];
                
                if (fzRemainingFoot <= 5.0) { 
                    T5_idx = i;
                    T5_val = timeData[i];
                    fzAtT5 = fzData[i]; // Lấy giá trị Fz Total trên biểu đồ chính
                    break;
                }
            }
        }

        chartWrapper.style.display = 'block'; 
        resultDiv.innerHTML = `
            <div class="card card-full animate">
                <h3>Baseline STW (0 - 5.0s)</h3>
                <div class="value">${meanFz5s.toFixed(2)}<span class="unit">N</span></div>
                <div class="info-footer">Ngưỡng T0: <b>${thresholdT0.toFixed(2)} N</b></div>
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
                <h3>T3 (Phân tách)</h3>
                <div class="value" style="color: #3b82f6;">${T3_val !== null ? T3_val.toFixed(4) : "---"}</div>
                <div class="info-footer">Ref: ${refStableLabel}</div>
            </div>
            <div class="card animate" style="border-top: 4px solid #8b5cf6;">
                <h3>T4 (Nhấc 1 chân)</h3>
                <div class="value" style="color: #8b5cf6;">${T4_val !== null ? T4_val.toFixed(4) : "---"}</div>
                <div class="info-footer">${T4_val !== null ? `Nhấc chân ${footOffAtT4}` : "Không thấy FzA/B < 5%"}</div>
            </div>
            <div class="card animate" style="border-top: 4px solid #64748b;">
                <h3>T5 (Rời bàn lực)</h3>
                <div class="value" style="color: #64748b;">${T5_val !== null ? T5_val.toFixed(4) : "---"}</div>
                <div class="info-footer">${T5_val !== null ? `Chân ${footOffAtT4 === 'A' ? 'B' : 'A'} <= 5N` : "Không tìm thấy"}</div>
            </div>
        `;

        drawChart(timeData, fzData, fzAData, fzBData, T0_val, T1_val, T2_val, T3_val, T4_val, T5_val, null, null);

    } catch (err) {
        console.error(err); alert("Lỗi phân tích STW: " + err.message);
    }
}

// ==========================================
// HỆ THỐNG VẼ BIỂU ĐỒ & ZOOM
// ==========================================
function resetChartZoom() {
    if (fzChartInstance) fzChartInstance.resetZoom();
}

function drawChart(labels, dataTotal, dataA, dataB, T0, T1, T2, T3, T4, T5, lMax, lMin) {
    const ctx = document.getElementById('fzChart').getContext('2d');
    if (fzChartInstance) fzChartInstance.destroy();

    const annotations = {};
    
    function addLine(id, value, color, text) {
        if (value !== null && value !== undefined) {
            annotations[id] = {
                type: 'line', xMin: value, xMax: value,
                borderColor: color, borderWidth: 2, borderDash: [4, 4],
                label: { display: true, content: text, position: 'start', backgroundColor: color, color: '#fff', font: { size: 10 } }
            };
        }
    }

    function addThinLine(id, value, text) {
        if (value !== null && value !== undefined && value !== T4 && value !== T5) {
            annotations[id] = {
                type: 'line', xMin: value, xMax: value,
                borderColor: '#94a3b8', borderWidth: 1, borderDash: [2, 2],
                label: { display: true, content: text, position: 'end', backgroundColor: 'rgba(148, 163, 184, 0.8)', color: '#fff', font: { size: 9 } }
            };
        }
    }

    addLine('l0', T0, '#ef4444', 'T0');
    addLine('l1', T1, '#10b981', 'T1');
    addLine('l2', T2, '#f59e0b', 'T2');
    addLine('l3', T3, '#3b82f6', 'T3');
    addLine('l4', T4, '#8b5cf6', 'T4');
    addLine('l5', T5, '#64748b', 'T5');
    
    addThinLine('lMax', lMax, 'C.Đại phụ');
    addThinLine('lMin', lMin, 'C.Tiểu phụ');

    fzChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { 
                    label: 'Fz Total (N)', 
                    data: dataTotal, 
                    borderColor: '#2563eb', 
                    borderWidth: 1.5, 
                    pointRadius: 0, 
                    fill: false, 
                    tension: 0.1 
                },
                { 
                    label: 'Fz Forceplate A (N)', 
                    data: dataA, 
                    borderColor: '#ef4444', 
                    borderWidth: 1.2, 
                    borderDash: [5, 5], 
                    pointRadius: 0, 
                    fill: false, 
                    tension: 0.1 
                },
                { 
                    label: 'Fz Forceplate B (N)', 
                    data: dataB, 
                    borderColor: '#10b981', 
                    borderWidth: 1.2, 
                    borderDash: [5, 5], 
                    pointRadius: 0, 
                    fill: false, 
                    tension: 0.1 
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            scales: { x: { type: 'linear', title: { display: true, text: 'Thời gian (s)' } }, y: { title: { display: true, text: 'Lực Fz (N)' } } },
            plugins: {
                legend: { display: true, position: 'top', labels: { boxWidth: 12 } },
                annotation: { annotations: annotations },
                zoom: {
                    pan: { enabled: true, mode: 'x' },
                    zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
                }
            }
        }
    });
}
