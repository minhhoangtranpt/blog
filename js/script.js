// ==========================================
// BÀI TEST 1: SIT TO STAND (STS) - BẢN HOÀN CHỈNH
// ==========================================
function analyzeSTS(timeData, fzData) {
    const resultDiv = document.getElementById('result');
    const windowMsInput = document.getElementById('windowMs');
    const chartWrapper = document.getElementById('chartWrapper');

    try {
        // Mốc chặn tìm kiếm chung (có thể giữ 15-20s để bao quát hết 14s của T3)
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
        
        let localMax_val = null, localMin_val = null, lMaxFz = null;

        const sampleRate = 1 / (timeData[1] - timeData[0]);
        const windowMs = parseInt(windowMsInput ? windowMsInput.value : 20) || 20;
        const windowSize = Math.ceil((windowMs / 1000) * sampleRate);

        // 1. Tìm T0
        for (let i = 0; i < limitIdx - windowSize; i++) {
            let isStable = true;
            for (let j = 0; j < windowSize; j++) {
                if (fzData[i + j] >= thresholdT0) { isStable = false; break; }
            }
            if (isStable) { T0_val = timeData[i]; T0_idx = i; fzAtT0 = fzData[i]; break; }
        }

        // 2. Tìm T1
        if (T0_idx !== -1) {
            for (let i = T0_idx + 1; i < limitIdx; i++) {
                if (fzData[i] >= fzAtT0) { T1_val = timeData[i]; T1_idx = i; fzAtT1 = fzData[i]; break; }
            }
        }

        // 3. Tìm T2 (Cực đại chính)
        let searchStartT2 = (T1_idx !== -1) ? T1_idx : ((T0_idx !== -1) ? T0_idx : 0);
        let maxFz = -Infinity;
        for (let i = searchStartT2; i < limitIdx; i++) {
            if (fzData[i] > maxFz) { maxFz = fzData[i]; T2_val = timeData[i]; T2_idx = i; fzAtT2 = fzData[i]; }
        }

        // 4. Tìm T4 (Cực tiểu chính)
        if (T2_idx !== -1) {
            let minFz = Infinity;
            for (let i = T2_idx; i < limitIdx; i++) {
                if (fzData[i] < minFz) { minFz = fzData[i]; T4_val = timeData[i]; T4_idx = i; fzAtT4 = fzData[i]; }
            }
        }

        // 5. Tìm cực đại phụ (để làm mốc chặn Fz cho T3)
        if (T4_idx !== -1) {
            const maxTimeWindow = timeData[T4_idx] + 0.5; 
            let endWindowIdx = T4_idx;
            while (endWindowIdx < limitIdx && timeData[endWindowIdx] <= maxTimeWindow) { endWindowIdx++; }

            let lMaxIdx = T4_idx;
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

        // 6. Tìm T3 (Điều chỉnh theo yêu cầu: Quét 8s-14s, nằm trong T2-T4)
        const stableMs = 500; 
        const stableW = Math.ceil((stableMs / 1000) * sampleRate);

        // Hàm tìm vùng ổn định nhất trong khoảng thời gian cụ thể
        function findT3Stable(startTime, endTime, maxAllowedFz) {
            let startIdx = timeData.findIndex(t => t >= startTime);
            let endIdx = timeData.findIndex(t => t >= endTime);
            if (startIdx === -1) return null;
            if (endIdx === -1) endIdx = timeData.length - 1;

            let minDiff = Infinity, bestIdx = -1, bestMean = 0;

            for (let i = startIdx; i <= endIdx - stableW; i++) {
                let maxW = -Infinity, minW = Infinity, sumW = 0;
                for (let j = 0; j < stableW; j++) {
                    let v = fzData[i + j];
                    if (v > maxW) maxW = v; if (v < minW) minW = v; sumW += v;
                }
                let currentMean = sumW / stableW;

                // Điều kiện Fz < Cực đại phụ
                if (maxAllowedFz !== null && currentMean >= maxAllowedFz) continue;

                if ((maxW - minW) < minDiff) {
                    minDiff = maxW - minW; 
                    bestIdx = i + Math.floor(stableW / 2); 
                    bestMean = currentMean;
                }
            }
            return bestIdx !== -1 ? { idx: bestIdx, val: timeData[bestIdx], fz: bestMean } : null;
        }

        // Thực hiện quét trong 8s - 14s
        let resultT3 = findT3Stable(8.0, 14.0, lMaxFz);

        if (resultT3) {
            // Kiểm tra nếu điểm tìm được nằm trong khoảng [T2, T4]
            if (T2_val !== null && T4_val !== null) {
                if (resultT3.val >= T2_val && resultT3.val <= T4_val) {
                    T3_val = resultT3.val;
                    T3_idx = resultT3.idx;
                    fzAtT3 = resultT3.fz;
                }
            } else {
                // Nếu không có T2/T4 để đối chiếu, vẫn gán kết quả từ 8-14s
                T3_val = resultT3.val;
                T3_idx = resultT3.idx;
                fzAtT3 = resultT3.fz;
            }
        }

        // 7. Tìm T5
        if (T4_idx !== -1 && fzAtT3 !== null) {
            for (let i = T4_idx + 1; i < limitIdx; i++) {
                if (fzData[i] >= fzAtT3) { 
                    T5_val = timeData[i]; T5_idx = i; fzAtT5 = fzData[i]; 
                    break; 
                }
            }
        }

        // Hiển thị kết quả (Giữ nguyên phần UI của bạn)
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
                <h3>T3 (Ổn định 8-14s)</h3>
                <div class="value" style="color: #3b82f6;">${T3_val !== null ? T3_val.toFixed(4) : "---"}</div>
                <div class="info-footer">Fz TB: ${fzAtT3 !== null ? fzAtT3.toFixed(2) : "---"} N</div>
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
        
        drawChart(timeData, fzData, T0_val, T1_val, T2_val, T3_val, T4_val, T5_val, localMax_val, localMin_val);

    } catch (err) {
        console.error(err); alert("Lỗi phân tích STS: " + err.message);
    }
}
