// ==========================================
// BÀI TEST 1: SIT TO STAND (STS) - CẬP NHẬT LOGIC T3
// ==========================================
function analyzeSTS(timeData, fzData) {
    const resultDiv = document.getElementById('result');
    const windowMsInput = document.getElementById('windowMs');
    const chartWrapper = document.getElementById('chartWrapper');

    try {
        // Tăng giới hạn quét lên 20s để bao quát vùng tham chiếu 8-14s
        let limitIdx = timeData.findIndex(t => t > 20.0);
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
        
        let lMaxFz = null; 

        const sampleRate = 1 / (timeData[1] - timeData[0]);
        const windowSize = Math.ceil((20 / 1000) * sampleRate);

        // 1. Tìm T0, T1, T2, T4 (Giữ nguyên logic cũ)
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
        let searchStartT2 = (T1_idx !== -1) ? T1_idx : 0;
        let maxFzTemp = -Infinity;
        for (let i = searchStartT2; i < limitIdx; i++) {
            if (fzData[i] > maxFzTemp) { maxFzTemp = fzData[i]; T2_val = timeData[i]; T2_idx = i; fzAtT2 = fzData[i]; }
        }
        if (T2_idx !== -1) {
            let minFzTemp = Infinity;
            for (let i = T2_idx; i < limitIdx; i++) {
                if (fzData[i] < minFzTemp) { minFzTemp = fzData[i]; T4_val = timeData[i]; T4_idx = i; fzAtT4 = fzData[i]; }
            }
        }

        // 2. Tìm giá trị Fz tham chiếu từ vùng 8s - 14s
        const stableW = Math.ceil((500 / 1000) * sampleRate); // Cửa sổ 500ms
        let start8sIdx = timeData.findIndex(t => t >= 8.0);
        let end14sIdx = timeData.findIndex(t => t >= 14.0);
        if (end14sIdx === -1) end14sIdx = timeData.length - 1;

        let bestRefFz = null;
        let minDiffStable = Infinity;

        if (start8sIdx !== -1 && start8sIdx < end14sIdx) {
            for (let i = start8sIdx; i <= end14sIdx - stableW; i++) {
                let maxW = -Infinity, minW = Infinity, sumW = 0;
                for (let j = 0; j < stableW; j++) {
                    let v = fzData[i + j];
                    if (v > maxW) maxW = v; if (v < minW) minW = v; sumW += v;
                }
                if ((maxW - minW) < minDiffStable) {
                    minDiffStable = maxW - minW;
                    bestRefFz = sumW / stableW; // Đây là mức Fz "chuẩn"
                }
            }
        }

        // 3. Tìm T3: Điểm giữa T2 và T4 có Fz gần với bestRefFz nhất
        if (bestRefFz !== null && T2_idx !== -1 && T4_idx !== -1) {
            let closestDiff = Infinity;
            for (let i = T2_idx; i <= T4_idx; i++) {
                let currentDiff = Math.abs(fzData[i] - bestRefFz);
                if (currentDiff < closestDiff) {
                    closestDiff = currentDiff;
                    T3_idx = i;
                    T3_val = timeData[i];
                    fzAtT3 = fzData[i]; // Lấy Fz thực tế tại thời điểm đó
                }
            }
        }

        // 4. Tìm T5 (Sau T4, điểm chạm lại mức Fz của T3)
        if (T4_idx !== -1 && fzAtT3 !== null) {
            for (let i = T4_idx + 1; i < limitIdx; i++) {
                if (fzData[i] >= fzAtT3) { 
                    T5_val = timeData[i]; T5_idx = i; fzAtT5 = fzData[i]; 
                    break; 
                }
            }
        }

        // Hiển thị kết quả
        chartWrapper.style.display = 'block'; 
        resultDiv.innerHTML = `
            <div class="card card-full animate">
                <h3>Tham chiếu ổn định (8s-14s)</h3>
                <div class="value">${bestRefFz ? bestRefFz.toFixed(2) : "---"}<span class="unit">N</span></div>
            </div>
            <div class="card animate" style="border-top: 4px solid #f59e0b;">
                <h3>T2 (Cực đại)</h3>
                <div class="value" style="color: #f59e0b;">${T2_val !== null ? T2_val.toFixed(4) : "---"}</div>
            </div>
            <div class="card animate" style="border-top: 4px solid #3b82f6;">
                <h3>T3 (Điểm khớp Fz)</h3>
                <div class="value" style="color: #3b82f6;">${T3_val !== null ? T3_val.toFixed(4) : "---"}</div>
                <div class="info-footer">Fz tại điểm: ${fzAtT3 ? fzAtT3.toFixed(2) : "---"} N</div>
            </div>
            <div class="card animate" style="border-top: 4px solid #8b5cf6;">
                <h3>T4 (Cực tiểu)</h3>
                <div class="value" style="color: #8b5cf6;">${T4_val !== null ? T4_val.toFixed(4) : "---"}</div>
            </div>
        `;
        
        drawChart(timeData, fzData, T0_val, T1_val, T2_val, T3_val, T4_val, T5_val, null, null);

    } catch (err) {
        console.error(err); alert("Lỗi: " + err.message);
    }
}
