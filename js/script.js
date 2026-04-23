let fzChartInstance = null;

// BATCH & EDIT MODE MANAGEMENT
let batchFiles = [];
let currentFileIndex = 0;
let batchResults = []; 
let isEditMode = false;
let currentChartTimeData = [];
let currentChartFzData = [];

function processFiles() {
    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files.length) {
        alert("Please select at least one .txt file!");
        return;
    }
    batchFiles = Array.from(fileInput.files);
    currentFileIndex = 0;
    batchResults = new Array(batchFiles.length).fill(null);
    document.getElementById('batchControls').style.display = 'flex';
    updateBatchUI();
    readAndAnalyzeCurrentFile();
}

function updateBatchUI() {
    const progressText = `File ${currentFileIndex + 1}/${batchFiles.length}: ${batchFiles[currentFileIndex].name}`;
    document.getElementById('fileProgress').innerText = progressText;
    document.getElementById('prevBtn').disabled = currentFileIndex === 0;
    document.getElementById('prevBtn').style.opacity = currentFileIndex === 0 ? "0.5" : "1";
    document.getElementById('nextBtn').disabled = currentFileIndex === batchFiles.length - 1;
    document.getElementById('nextBtn').style.opacity = currentFileIndex === batchFiles.length - 1 ? "0.5" : "1";
    
    if (isEditMode) toggleEditMode();
}

function prevFile() {
    if (currentFileIndex > 0) {
        currentFileIndex--;
        updateBatchUI();
        readAndAnalyzeCurrentFile();
    }
}

function nextFile() {
    if (currentFileIndex < batchFiles.length - 1) {
        currentFileIndex++;
        updateBatchUI();
        readAndAnalyzeCurrentFile();
    }
}

function readAndAnalyzeCurrentFile() {
    const file = batchFiles[currentFileIndex];
    const analysisMode = document.getElementById('analysisMode').value;
    const reader = new FileReader();

    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split(/\r?\n/);
        let dataStartIndex = -1;
        let subjectWeight = null;
        let fileDescription = "Unknown";
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes("File Description")) {
                const parts = lines[i].split('\t');
                if (parts.length > 1) { fileDescription = parts[1].trim(); }
            }
            if (lines[i].includes("Subject weight (kg)")) {
                const parts = lines[i].split('\t');
                if (parts.length > 1) { subjectWeight = parseFloat(parts[1]); }
            }
            if (lines[i].includes("Time (s)")) {
                dataStartIndex = (lines[i+1] && lines[i+1].includes("TOTAL")) ? i + 2 : i + 1;
                break;
            }
        }

        if (dataStartIndex === -1) { return; }

        const COL_COPX_TOT = 2; 
        const COL_COPY_TOT = 3; 
        const COL_COPX_A = 15;  
        const COL_COPY_A = 16;  
        const COL_COPX_B = 24;  
        const COL_COPY_B = 25;  

        let timeData = [], fzData = [], fzAData = [], fzBData = [];
        let copxTot = [], copyTot = [], copxA = [], copyA = [], copxB = [], copyB = [];

        for (let i = dataStartIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split('\t');
            const t = parseFloat(cols[0]), fz = parseFloat(cols[1]), fzA = parseFloat(cols[14]), fzB = parseFloat(cols[23]); 
            
            if (!isNaN(t) && !isNaN(fz)) {
                timeData.push(t); fzData.push(fz); fzAData.push(isNaN(fzA) ? 0 : fzA); fzBData.push(isNaN(fzB) ? 0 : fzB);
                
                copxTot.push(parseFloat(cols[COL_COPX_TOT]));
                copyTot.push(parseFloat(cols[COL_COPY_TOT]));
                copxA.push(parseFloat(cols[COL_COPX_A]));
                copyA.push(parseFloat(cols[COL_COPY_A]));
                copxB.push(parseFloat(cols[COL_COPX_B]));
                copyB.push(parseFloat(cols[COL_COPY_B]));
            }
        }

        if (timeData.length < 2) return;
        
        currentChartTimeData = timeData;
        currentChartFzData = fzData;

        const copData = { copxTot, copyTot, copxA, copyA, copxB, copyB };

        if (analysisMode === 'sts') analyzeSTS(timeData, fzData, fzAData, fzBData, copData, file.name, fileDescription);
        else if (analysisMode === 'stw') analyzeSTW(timeData, fzData, fzAData, fzBData, copData, subjectWeight, file.name, fileDescription);
    };
    reader.readAsText(file);
}

function toggleEditMode() {
    isEditMode = !isEditMode;
    const btn = document.getElementById('editModeBtn');
    const status = document.getElementById('editStatus');
    const canvas = document.getElementById('fzChart');
    
    if (isEditMode) {
        btn.style.background = '#ef4444';
        btn.style.color = '#fff';
        btn.innerText = 'Disable Edit Mode';
        status.style.display = 'inline';
        canvas.style.cursor = 'crosshair';
    } else {
        btn.style.background = '#eab308';
        btn.style.color = '#1e293b';
        btn.innerText = 'Enable Edit Mode';
        status.style.display = 'none';
        canvas.style.cursor = 'default';
    }
}

// ==========================================
// FILE PARSING & CSV EXPORT
// ==========================================
function parseFileInfo(description) {
    let group = "Unknown";
    const descUpper = description.toUpperCase();
    
    if (descUpper.startsWith("K")) group = "HE";
    else if (descUpper.startsWith("B")) group = "KOA";

    let task = "Unknown";
    const taskMap = {
        "13": "Đứng lên và đi với vị trí chân đối xứng, 2 TAY TỰ DO lần 1",
        "14": "Đứng lên và đi với vị trí chân đối xứng, 2 TAY TỰ DO lần 2",
        "15": "Đứng lên và đi với vị trí chân đối xứng, 2 TAY TỰ DO lần 3",
        "16": "Đứng lên và đi với vị trí chân đối xứng, 2 TAY CHỐNG GỐI lần 1",
        "17": "Đứng lên và đi với vị trí chân đối xứng, 2 TAY CHỐNG GỐI lần 2",
        "18": "Đứng lên và đi với vị trí chân đối xứng, 2 TAY CHỐNG GỐI lần 3",
        "19": "Đứng lên và đi với vị trí chân ra sau, 2 TAY TỰ DO lần 1",
        "20": "Đứng lên và đi với vị trí chân ra sau, 2 TAY TỰ DO lần 2",
        "21": "Đứng lên và đi với vị trí chân ra sau, 2 TAY TỰ DO lần 3",
        "22": "Đứng lên và đi với vị trí chân ra sau, 2 TAY CHỐNG GỐI lần 1",
        "23": "Đứng lên và đi với vị trí chân ra sau, 2 TAY CHỐNG GỐI lần 2",
        "24": "Đứng lên và đi với vị trí chân ra sau, 2 TAY CHỐNG GỐI lần 3"
    };

    const match = description.match(/_(1[3-9]|2[0-4])/);
    if (match && match[1]) task = taskMap[match[1]];

    return { group, task };
}

function exportBatchResults() {
    let unanalyzedCount = batchResults.filter(res => res === null).length;
    if (unanalyzedCount > 0) {
        let confirmExport = confirm(`There are ${unanalyzedCount} unanalyzed files. Do you still want to download the analyzed results?`);
        if (!confirmExport) return;
    }

    let fileContent = "File_Name,File_Description,Group,Task,Mode,Baseline_N,T0_s,T0_Note,T1_s,T1_Note,T2_s,T2_Note,T3_s,T3_Note,T4_s,T4_Note,T5_s,T5_Note," +
                      "Dur_T0_T1,Dur_T1_T2,Dur_T2_T3,Dur_T3_T4,Dur_T4_T5,Dur_Total," + 
                      "Amp_COPx_Tot,Amp_COPx_Right_Tot,Amp_COPx_Left_Tot,Amp_COPy_Tot,Amp_COPy_Front_Tot,Amp_COPy_Back_Tot," + 
                      "Amp_COPx_A,Amp_COPx_Right_A,Amp_COPx_Left_A,Amp_COPy_A,Amp_COPy_Front_A,Amp_COPy_Back_A," + 
                      "Amp_COPx_B,Amp_COPx_Right_B,Amp_COPx_Left_B,Amp_COPy_B,Amp_COPy_Front_B,Amp_COPy_Back_B," + 
                      "Path_Tot,Path_A,Path_B\r\n";
    
    batchResults.forEach(res => {
        if (res) {
            const fileInfo = parseFileInfo(res.FileDesc);
            const safeTask = `"${fileInfo.task}"`; 
            
            fileContent += `${res.File},${res.FileDesc},${fileInfo.group},${safeTask},${res.Mode},${res.Baseline},` + 
                           `${res.T0},${res.T0_type},${res.T1},${res.T1_type},${res.T2},${res.T2_type},` + 
                           `${res.T3},${res.T3_type},${res.T4},${res.T4_type},${res.T5},${res.T5_type},` +
                           `${res.Dur_T0_T1},${res.Dur_T1_T2},${res.Dur_T2_T3},${res.Dur_T3_T4},${res.Dur_T4_T5},${res.Dur_Total},` +
                           `${res.Amp_COPx_Tot},${res.Amp_COPx_Right_Tot},${res.Amp_COPx_Left_Tot},${res.Amp_COPy_Tot},${res.Amp_COPy_Front_Tot},${res.Amp_COPy_Back_Tot},` +
                           `${res.Amp_COPx_A},${res.Amp_COPx_Right_A},${res.Amp_COPx_Left_A},${res.Amp_COPy_A},${res.Amp_COPy_Front_A},${res.Amp_COPy_Back_A},` +
                           `${res.Amp_COPx_B},${res.Amp_COPx_Right_B},${res.Amp_COPx_Left_B},${res.Amp_COPy_B},${res.Amp_COPy_Front_B},${res.Amp_COPy_Back_B},` +
                           `${res.Path_Tot},${res.Path_A},${res.Path_B}\r\n`;
        }
    });

    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, fileContent], { type: 'text/csv;charset=utf-8;' }); 
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "TwinPlates_Batch_Results.csv"; 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================
// CẬP NHẬT TÍNH TOÁN COP (Lấy trị tuyệt đối cho cả Phải/Trước)
// ==========================================
function calcAmpDetails(arr, start, end) {
    if (start >= end) return { total: "", max: "", min: "", absMax: "", absMin: "" };
    const slice = arr.slice(start, end + 1).filter(v => !isNaN(v) && v !== null);
    if (slice.length === 0) return { total: "", max: "", min: "", absMax: "", absMin: "" };
    
    const maxVal = Math.max(...slice); // Cực đại (tương ứng với Phải / Trước)
    const minVal = Math.min(...slice); // Cực tiểu (tương ứng với Trái / Sau)
    
    return {
        total: (maxVal - minVal).toFixed(4),
        max: maxVal.toFixed(4),
        min: minVal.toFixed(4),
        absMax: Math.abs(maxVal).toFixed(4), // Đã cập nhật: Lấy trị tuyệt đối
        absMin: Math.abs(minVal).toFixed(4)  // Đã cập nhật: Lấy trị tuyệt đối
    };
}

function calcPathLen(arrX, arrY, start, end) {
    if (start >= end) return "";
    let path = 0;
    let lastValidX = null, lastValidY = null;
    for (let i = start; i <= end; i++) {
        const x = arrX[i];
        const y = arrY[i];
        if (!isNaN(x) && !isNaN(y)) {
            if (lastValidX !== null && lastValidY !== null) {
                path += Math.sqrt(Math.pow(x - lastValidX, 2) + Math.pow(y - lastValidY, 2));
            }
            lastValidX = x;
            lastValidY = y;
        }
    }
    return path.toFixed(4);
}

// ==========================================
// TEST 1: SIT TO STAND (STS)
// ==========================================
function analyzeSTS(timeData, fzData, fzAData, fzBData, copData, fileName, fileDescription) {
    const resultDiv = document.getElementById('result');
    const windowMsInput = document.getElementById('windowMs');
    const chartWrapper = document.getElementById('chartWrapper');

    let limitIdx = timeData.findIndex(t => t > 15.0);
    if (limitIdx === -1) limitIdx = timeData.length; 

    const fz5s = fzData.filter((_, idx) => timeData[idx] <= 5.0);
    const meanFz5s = jStat.mean(fz5s);
    const stdFz5s = jStat.stdev(fz5s);
    const thresholdT0 = meanFz5s - (3 * stdFz5s);

    let T0_val = null, T1_val = null, T2_val = null, T3_val = null, T4_val = null, T5_val = null;
    let T0_idx = -1, T1_idx = -1, T2_idx = -1, T3_idx = -1, T4_idx = -1, T5_idx = -1;
    let fzAtT0 = null, fzAtT1 = null, fzAtT2 = null, fzAtT3 = null, fzAtT4 = null, fzAtT5 = null;
    let localMax_val = null, localMin_val = null, lMaxFz = null, lMaxIdx = -1; 

    const sampleRate = 1 / (timeData[1] - timeData[0]);
    const windowSize = Math.ceil(((parseInt(windowMsInput ? windowMsInput.value : 20) || 20) / 1000) * sampleRate);

    for (let i = 0; i < limitIdx - windowSize; i++) {
        let isStable = true;
        for (let j = 0; j < windowSize; j++) { if (fzData[i + j] >= thresholdT0) { isStable = false; break; } }
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
        while (endWindowIdx < limitIdx && timeData[endWindowIdx] <= maxTimeWindow) endWindowIdx++;
        lMaxIdx = T4_idx; lMaxFz = fzData[T4_idx];
        for (let i = T4_idx + 1; i < endWindowIdx; i++) { if (fzData[i] > lMaxFz) { lMaxFz = fzData[i]; lMaxIdx = i; } }
        localMax_val = timeData[lMaxIdx];
        let lMinIdx = lMaxIdx, lMinFz = fzData[lMaxIdx];
        for (let i = lMaxIdx + 1; i < endWindowIdx; i++) { if (fzData[i] < lMinFz) { lMinFz = fzData[i]; lMinIdx = i; } }
        localMin_val = timeData[lMinIdx];
    }

    const stableW = Math.ceil((500 / 1000) * sampleRate);
    let idx8s = timeData.findIndex(t => t >= 8.0);
    let idx14s = timeData.findIndex(t => t >= 14.0);
    if (idx14s === -1) idx14s = timeData.length - 1;

    let refStableFz = null;
    if (idx8s !== -1 && idx8s < idx14s && (idx14s - idx8s >= stableW)) {
        let minDiff = Infinity;
        for (let i = idx8s; i <= idx14s - stableW; i++) {
            let maxW = -Infinity, minW = Infinity, sumW = 0;
            for (let j = 0; j < stableW; j++) {
                let v = fzData[i + j];
                if (v > maxW) maxW = v; if (v < minW) minW = v; sumW += v;
            }
            if ((maxW - minW) < minDiff) { minDiff = maxW - minW; refStableFz = sumW / stableW; }
        }
    }

    if (T2_idx !== -1 && T4_idx !== -1 && refStableFz !== null) {
        for (let i = T4_idx; i >= T2_idx; i--) {
            if (fzData[i] >= refStableFz) { T3_idx = i; T3_val = timeData[i]; fzAtT3 = fzData[i]; break; }
        }
    }

    if (T4_idx !== -1 && fzAtT3 !== null) {
        for (let i = T4_idx + 1; i < limitIdx; i++) {
            if (fzData[i] >= fzAtT3) { T5_val = timeData[i]; T5_idx = i; fzAtT5 = fzData[i]; break; }
        }
    }

    let dur_T0_T1 = "", dur_T1_T2 = "", dur_T2_T3 = "", dur_T3_T4 = "", dur_T4_T5 = "", dur_Total = "";
    if (T0_val !== null && T1_val !== null) dur_T0_T1 = (T1_val - T0_val).toFixed(4);
    if (T1_val !== null && T2_val !== null) dur_T1_T2 = (T2_val - T1_val).toFixed(4);
    if (T2_val !== null && T3_val !== null) dur_T2_T3 = (T3_val - T2_val).toFixed(4);
    if (T3_val !== null && T4_val !== null) dur_T3_T4 = (T4_val - T3_val).toFixed(4);
    if (T4_val !== null && T5_val !== null) dur_T4_T5 = (T5_val - T4_val).toFixed(4);
    if (T0_val !== null && T5_val !== null) dur_Total = (T5_val - T0_val).toFixed(4);

    let startCopIdx = T0_idx !== -1 ? T0_idx : 0;
    let endCopIdx = T5_idx !== -1 ? T5_idx : (T4_idx !== -1 ? T4_idx : timeData.length - 1);

    let copxTot_amp = calcAmpDetails(copData.copxTot, startCopIdx, endCopIdx);
    let copyTot_amp = calcAmpDetails(copData.copyTot, startCopIdx, endCopIdx);
    let copxA_amp = calcAmpDetails(copData.copxA, startCopIdx, endCopIdx);
    let copyA_amp = calcAmpDetails(copData.copyA, startCopIdx, endCopIdx);
    let copxB_amp = calcAmpDetails(copData.copxB, startCopIdx, endCopIdx);
    let copyB_amp = calcAmpDetails(copData.copyB, startCopIdx, endCopIdx);
    
    let path_Tot = calcPathLen(copData.copxTot, copData.copyTot, startCopIdx, endCopIdx);
    let path_A = calcPathLen(copData.copxA, copData.copyA, startCopIdx, endCopIdx);
    let path_B = calcPathLen(copData.copxB, copData.copyB, startCopIdx, endCopIdx);

    // Sử dụng absMax cho Phải/Trước và absMin cho Trái/Sau
    batchResults[currentFileIndex] = {
        File: fileName, FileDesc: fileDescription, Mode: 'STS', Baseline: meanFz5s.toFixed(2),
        T0: T0_val !== null ? T0_val.toFixed(4) : "", T0_type: T0_val !== null ? "Auto" : "",
        T1: T1_val !== null ? T1_val.toFixed(4) : "", T1_type: T1_val !== null ? "Auto" : "",
        T2: T2_val !== null ? T2_val.toFixed(4) : "", T2_type: T2_val !== null ? "Auto" : "",
        T3: T3_val !== null ? T3_val.toFixed(4) : "", T3_type: T3_val !== null ? "Auto" : "",
        T4: T4_val !== null ? T4_val.toFixed(4) : "", T4_type: T4_val !== null ? "Auto" : "",
        T5: T5_val !== null ? T5_val.toFixed(4) : "", T5_type: T5_val !== null ? "Auto" : "",
        Dur_T0_T1: dur_T0_T1, Dur_T1_T2: dur_T1_T2, Dur_T2_T3: dur_T2_T3, 
        Dur_T3_T4: dur_T3_T4, Dur_T4_T5: dur_T4_T5, Dur_Total: dur_Total,
        Amp_COPx_Tot: copxTot_amp.total, Amp_COPx_Right_Tot: copxTot_amp.absMax, Amp_COPx_Left_Tot: copxTot_amp.absMin,
        Amp_COPy_Tot: copyTot_amp.total, Amp_COPy_Front_Tot: copyTot_amp.absMax, Amp_COPy_Back_Tot: copyTot_amp.absMin,
        Amp_COPx_A: copxA_amp.total, Amp_COPx_Right_A: copxA_amp.absMax, Amp_COPx_Left_A: copxA_amp.absMin,
        Amp_COPy_A: copyA_amp.total, Amp_COPy_Front_A: copyA_amp.absMax, Amp_COPy_Back_A: copyA_amp.absMin,
        Amp_COPx_B: copxB_amp.total, Amp_COPx_Right_B: copxB_amp.absMax, Amp_COPx_Left_B: copxB_amp.absMin,
        Amp_COPy_B: copyB_amp.total, Amp_COPy_Front_B: copyB_amp.absMax, Amp_COPy_Back_B: copyB_amp.absMin,
        Path_Tot: path_Tot, Path_A: path_A, Path_B: path_B
    };

    chartWrapper.style.display = 'block'; 
    resultDiv.innerHTML = `
        <div class="card card-full animate">
            <h3>Baseline STS (0 - 5.0s)</h3>
            <div class="value">${meanFz5s.toFixed(2)}<span class="unit">N</span></div>
        </div>
        <div class="card animate" style="border-top: 4px solid #ef4444;">
            <h3>T0 (Initiation)</h3>
            <div class="value" id="val_T0" style="color: #ef4444;">${T0_val !== null ? T0_val.toFixed(4) : "---"}</div>
            <div class="info-footer" id="info_T0">Fz: ${fzAtT0 !== null ? fzAtT0.toFixed(2) : "---"} N</div>
        </div>
        <div class="card animate" style="border-top: 4px solid #10b981;">
            <h3>T1 (Recovery)</h3>
            <div class="value" id="val_T1" style="color: #10b981;">${T1_val !== null ? T1_val.toFixed(4) : "---"}</div>
            <div class="info-footer" id="info_T1">Fz: ${fzAtT1 !== null ? fzAtT1.toFixed(2) : "---"} N</div>
        </div>
        <div class="card animate" style="border-top: 4px solid #f59e0b;">
            <h3>T2 (Peak)</h3>
            <div class="value" id="val_T2" style="color: #f59e0b;">${T2_val !== null ? T2_val.toFixed(4) : "---"}</div>
            <div class="info-footer" id="info_T2">Fz: ${fzAtT2 !== null ? fzAtT2.toFixed(2) : "---"} N</div>
        </div>
        <div class="card animate" style="border-top: 4px solid #3b82f6;">
            <h3>T3 (Stable 1)</h3>
            <div class="value" id="val_T3" style="color: #3b82f6;">${T3_val !== null ? T3_val.toFixed(4) : "---"}</div>
            <div class="info-footer" id="info_T3">Ref (8-14s): ${refStableFz !== null ? refStableFz.toFixed(2) : "---"} N</div>
        </div>
        <div class="card animate" style="border-top: 4px solid #8b5cf6;">
            <h3>T4 (Local Min)</h3>
            <div class="value" id="val_T4" style="color: #8b5cf6;">${T4_val !== null ? T4_val.toFixed(4) : "---"}</div>
            <div class="info-footer" id="info_T4">Fz Min: ${fzAtT4 !== null ? fzAtT4.toFixed(2) : "---"} N</div>
        </div>
        <div class="card animate" style="border-top: 4px solid #64748b;">
            <h3>T5 (Reach T3)</h3>
            <div class="value" id="val_T5" style="color: #64748b;">${T5_val !== null ? T5_val.toFixed(4) : "---"}</div>
            <div class="info-footer" id="info_T5">${fzAtT5 !== null ? `Fz: ${fzAtT5.toFixed(2)} N` : "Not found"}</div>
        </div>
    `;
    
    drawChart(timeData, fzData, fzAData, fzBData, T0_val, T1_val, T2_val, T3_val, T4_val, T5_val, localMax_val, localMin_val);
}

// ==========================================
// TEST 2: SIT TO WALK (STW)
// ==========================================
function analyzeSTW(timeData, fzData, fzAData, fzBData, copData, subjectWeight, fileName, fileDescription) {
    const resultDiv = document.getElementById('result');
    const windowMsInput = document.getElementById('windowMs');
    const chartWrapper = document.getElementById('chartWrapper');

    let limitIdx = timeData.findIndex(t => t > 15.0);
    if (limitIdx === -1) limitIdx = timeData.length; 

    const fz5s = fzData.filter((_, idx) => timeData[idx] <= 5.0);
    const meanFz5s = jStat.mean(fz5s);
    const stdFz5s = jStat.stdev(fz5s);
    const thresholdT0 = meanFz5s - (4 * stdFz5s);

    let T0_val = null, T1_val = null, T2_val = null, T3_val = null, T4_val = null, T5_val = null;
    let T0_idx = -1, T1_idx = -1, T2_idx = -1, T3_idx = -1, T4_idx = -1, T5_idx = -1;
    let fzAtT0 = null, fzAtT1 = null, fzAtT2 = null, fzAtT3 = null, fzAtT4 = null, fzAtT5 = null;

    const sampleRate = 1 / (timeData[1] - timeData[0]);
    const windowSize = Math.ceil(((parseInt(windowMsInput ? windowMsInput.value : 20) || 20) / 1000) * sampleRate);

    for (let i = 0; i < limitIdx - windowSize; i++) {
        let isStable = true;
        for (let j = 0; j < windowSize; j++) { if (fzData[i + j] >= thresholdT0) { isStable = false; break; } }
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

    let refStableFz = (subjectWeight !== null && !isNaN(subjectWeight)) ? subjectWeight * 9.81 : meanFz5s;
    if (T2_idx !== -1 && refStableFz !== null) {
        for (let i = T2_idx + 1; i < limitIdx; i++) {
            if (fzData[i] <= refStableFz) { T3_idx = i; T3_val = timeData[i]; fzAtT3 = fzData[i]; break; }
        }
    }

    const window50 = Math.ceil((50 / 1000) * sampleRate);
    let footOffAtT4 = null; 

    if (T3_idx !== -1 && refStableFz !== null) {
        const thresholdT4 = 0.05 * refStableFz; 
        for (let i = T3_idx; i <= timeData.length - window50; i++) {
            let isStableA = true, isStableB = true;
            for (let j = 0; j < window50; j++) {
                if (fzAData[i + j] >= thresholdT4) isStableA = false;
                if (fzBData[i + j] >= thresholdT4) isStableB = false;
                if (!isStableA && !isStableB) break;
            }
            if (isStableA || isStableB) {
                T4_idx = i; T4_val = timeData[i]; fzAtT4 = fzData[i]; footOffAtT4 = isStableA ? 'A' : 'B'; break;
            }
        }
    }

    if (T4_idx !== -1 && footOffAtT4 !== null) {
        for (let i = T4_idx; i < timeData.length; i++) {
            if ((footOffAtT4 === 'A' ? fzBData[i] : fzAData[i]) <= 5.0) { 
                T5_idx = i; T5_val = timeData[i]; fzAtT5 = fzData[i]; break;
            }
        }
    }

    let dur_T0_T1 = "", dur_T1_T2 = "", dur_T2_T3 = "", dur_T3_T4 = "", dur_T4_T5 = "", dur_Total = "";
    if (T0_val !== null && T1_val !== null) dur_T0_T1 = (T1_val - T0_val).toFixed(4);
    if (T1_val !== null && T2_val !== null) dur_T1_T2 = (T2_val - T1_val).toFixed(4);
    if (T2_val !== null && T3_val !== null) dur_T2_T3 = (T3_val - T2_val).toFixed(4);
    if (T3_val !== null && T4_val !== null) dur_T3_T4 = (T4_val - T3_val).toFixed(4);
    if (T4_val !== null && T5_val !== null) dur_T4_T5 = (T5_val - T4_val).toFixed(4);
    if (T0_val !== null && T5_val !== null) dur_Total = (T5_val - T0_val).toFixed(4);

    let startCopIdx = T0_idx !== -1 ? T0_idx : 0;
    let endCopIdx = T5_idx !== -1 ? T5_idx : (T4_idx !== -1 ? T4_idx : timeData.length - 1);

    let copxTot_amp = calcAmpDetails(copData.copxTot, startCopIdx, endCopIdx);
    let copyTot_amp = calcAmpDetails(copData.copyTot, startCopIdx, endCopIdx);
    let copxA_amp = calcAmpDetails(copData.copxA, startCopIdx, endCopIdx);
    let copyA_amp = calcAmpDetails(copData.copyA, startCopIdx, endCopIdx);
    let copxB_amp = calcAmpDetails(copData.copxB, startCopIdx, endCopIdx);
    let copyB_amp = calcAmpDetails(copData.copyB, startCopIdx, endCopIdx);
    
    let path_Tot = calcPathLen(copData.copxTot, copData.copyTot, startCopIdx, endCopIdx);
    let path_A = calcPathLen(copData.copxA, copData.copyA, startCopIdx, endCopIdx);
    let path_B = calcPathLen(copData.copxB, copData.copyB, startCopIdx, endCopIdx);

    batchResults[currentFileIndex] = {
        File: fileName, FileDesc: fileDescription, Mode: 'STW', Baseline: meanFz5s.toFixed(2),
        T0: T0_val !== null ? T0_val.toFixed(4) : "", T0_type: T0_val !== null ? "Auto" : "",
        T1: T1_val !== null ? T1_val.toFixed(4) : "", T1_type: T1_val !== null ? "Auto" : "",
        T2: T2_val !== null ? T2_val.toFixed(4) : "", T2_type: T2_val !== null ? "Auto" : "",
        T3: T3_val !== null ? T3_val.toFixed(4) : "", T3_type: T3_val !== null ? "Auto" : "",
        T4: T4_val !== null ? T4_val.toFixed(4) : "", T4_type: T4_val !== null ? "Auto" : "",
        T5: T5_val !== null ? T5_val.toFixed(4) : "", T5_type: T5_val !== null ? "Auto" : "",
        Dur_T0_T1: dur_T0_T1, Dur_T1_T2: dur_T1_T2, Dur_T2_T3: dur_T2_T3, 
        Dur_T3_T4: dur_T3_T4, Dur_T4_T5: dur_T4_T5, Dur_Total: dur_Total,
        Amp_COPx_Tot: copxTot_amp.total, Amp_COPx_Right_Tot: copxTot_amp.absMax, Amp_COPx_Left_Tot: copxTot_amp.absMin,
        Amp_COPy_Tot: copyTot_amp.total, Amp_COPy_Front_Tot: copyTot_amp.absMax, Amp_COPy_Back_Tot: copyTot_amp.absMin,
        Amp_COPx_A: copxA_amp.total, Amp_COPx_Right_A: copxA_amp.absMax, Amp_COPx_Left_A: copxA_amp.absMin,
        Amp_COPy_A: copyA_amp.total, Amp_COPy_Front_A: copyA_amp.absMax, Amp_COPy_Back_A: copyA_amp.absMin,
        Amp_COPx_B: copxB_amp.total, Amp_COPx_Right_B: copxB_amp.absMax, Amp_COPx_Left_B: copxB_amp.absMin,
        Amp_COPy_B: copyB_amp.total, Amp_COPy_Front_B: copyB_amp.absMax, Amp_COPy_Back_B: copyB_amp.absMin,
        Path_Tot: path_Tot, Path_A: path_A, Path_B: path_B
    };

    chartWrapper.style.display = 'block'; 
    resultDiv.innerHTML = `
        <div class="card card-full animate">
            <h3>Baseline STW (0 - 5.0s)</h3>
            <div class="value">${meanFz5s.toFixed(2)}<span class="unit">N</span></div>
        </div>
        <div class="card animate" style="border-top: 4px solid #ef4444;">
            <h3>T0 (Initiation)</h3>
            <div class="value" id="val_T0" style="color: #ef4444;">${T0_val !== null ? T0_val.toFixed(4) : "---"}</div>
            <div class="info-footer" id="info_T0">Fz: ${fzAtT0 !== null ? fzAtT0.toFixed(2) : "---"} N</div>
        </div>
        <div class="card animate" style="border-top: 4px solid #10b981;">
            <h3>T1 (Recovery)</h3>
            <div class="value" id="val_T1" style="color: #10b981;">${T1_val !== null ? T1_val.toFixed(4) : "---"}</div>
            <div class="info-footer" id="info_T1">Fz: ${fzAtT1 !== null ? fzAtT1.toFixed(2) : "---"} N</div>
        </div>
        <div class="card animate" style="border-top: 4px solid #f59e0b;">
            <h3>T2 (Peak)</h3>
            <div class="value" id="val_T2" style="color: #f59e0b;">${T2_val !== null ? T2_val.toFixed(4) : "---"}</div>
            <div class="info-footer" id="info_T2">Fz Peak: ${fzAtT2 !== null ? fzAtT2.toFixed(2) : "---"} N</div>
        </div>
        <div class="card animate" style="border-top: 4px solid #3b82f6;">
            <h3>T3 (Separation)</h3>
            <div class="value" id="val_T3" style="color: #3b82f6;">${T3_val !== null ? T3_val.toFixed(4) : "---"}</div>
            <div class="info-footer" id="info_T3">Fz: ${fzAtT3 !== null ? fzAtT3.toFixed(2) : "---"} N</div>
        </div>
        <div class="card animate" style="border-top: 4px solid #8b5cf6;">
            <h3>T4 (Foot Off)</h3>
            <div class="value" id="val_T4" style="color: #8b5cf6;">${T4_val !== null ? T4_val.toFixed(4) : "---"}</div>
            <div class="info-footer" id="info_T4">${T4_val !== null ? `Lifted foot ${footOffAtT4}` : "Not found"}</div>
        </div>
        <div class="card animate" style="border-top: 4px solid #64748b;">
            <h3>T5 (Off Forceplate)</h3>
            <div class="value" id="val_T5" style="color: #64748b;">${T5_val !== null ? T5_val.toFixed(4) : "---"}</div>
            <div class="info-footer" id="info_T5">${fzAtT5 !== null ? `Fz: ${fzAtT5.toFixed(2)} N` : "Not found"}</div>
        </div>
    `;

    drawChart(timeData, fzData, fzAData, fzBData, T0_val, T1_val, T2_val, T3_val, T4_val, T5_val, null, null);
}

// ==========================================
// CHART RENDERING & CLICK-TO-SNAP EDIT
// ==========================================
function resetChartZoom() { if (fzChartInstance) fzChartInstance.resetZoom(); }

function drawChart(labels, dataTotal, dataA, dataB, T0, T1, T2, T3, T4, T5, lMax, lMin) {
    const ctx = document.getElementById('fzChart').getContext('2d');
    if (fzChartInstance) fzChartInstance.destroy();

    const annotations = {};
    const markerColors = { 'T0': '#ef4444', 'T1': '#10b981', 'T2': '#f59e0b', 'T3': '#3b82f6', 'T4': '#8b5cf6', 'T5': '#64748b' };
    
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
                type: 'line', xMin: value, xMax: value, borderColor: '#94a3b8', borderWidth: 1, borderDash: [2, 2],
                label: { display: true, content: text, position: 'end', backgroundColor: 'rgba(148, 163, 184, 0.8)', color: '#fff', font: { size: 9 } }
            };
        }
    }

    addLine('l0', T0, markerColors['T0'], 'T0');
    addLine('l1', T1, markerColors['T1'], 'T1');
    addLine('l2', T2, markerColors['T2'], 'T2');
    addLine('l3', T3, markerColors['T3'], 'T3');
    addLine('l4', T4, markerColors['T4'], 'T4');
    addLine('l5', T5, markerColors['T5'], 'T5');
    addThinLine('lMax', lMax, 'Local Max');
    addThinLine('lMin', lMin, 'Local Min');

    fzChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Fz Total (N)', data: dataTotal, borderColor: '#2563eb', borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.1 },
                { label: 'Fz Forceplate A', data: dataA, borderColor: '#ef4444', borderWidth: 1.2, borderDash: [5, 5], pointRadius: 0, fill: false, tension: 0.1 },
                { label: 'Fz Forceplate B', data: dataB, borderColor: '#10b981', borderWidth: 1.2, borderDash: [5, 5], pointRadius: 0, fill: false, tension: 0.1 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            scales: { x: { type: 'linear', title: { display: true, text: 'Time (s)' } }, y: { title: { display: true, text: 'Force Fz (N)' } } },
            plugins: {
                legend: { display: true, position: 'top', labels: { boxWidth: 12 } },
                annotation: { annotations: annotations },
                zoom: { pan: { enabled: true, mode: 'x' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' } }
            },
            onClick: (e, elements, chart) => {
                if (!isEditMode) return;
                
                const canvasPosition = Chart.helpers.getRelativePosition(e, chart);
                const dataX = chart.scales.x.getValueForPixel(canvasPosition.x);
                
                let closestIdx = 0;
                let minDiff = Infinity;
                for (let i = 0; i < currentChartTimeData.length; i++) {
                    let diff = Math.abs(currentChartTimeData[i] - dataX);
                    if (diff < minDiff) { minDiff = diff; closestIdx = i; }
                }
                
                const newTime = currentChartTimeData[closestIdx];
                const newFz = currentChartFzData[closestIdx];
                const selectedMarker = document.getElementById('editMarkerSelect').value; 
                const annId = 'l' + selectedMarker.charAt(1); 
                
                if (batchResults[currentFileIndex]) {
                    batchResults[currentFileIndex][selectedMarker] = newTime.toFixed(4);
                    batchResults[currentFileIndex][selectedMarker + '_type'] = "Manual"; 
                }
                
                const annots = chart.options.plugins.annotation.annotations;
                if (!annots[annId]) {
                    annots[annId] = {
                        type: 'line', xMin: newTime, xMax: newTime,
                        borderColor: markerColors[selectedMarker], borderWidth: 2, borderDash: [4, 4],
                        label: { display: true, content: selectedMarker, position: 'start', backgroundColor: markerColors[selectedMarker], color: '#fff', font: { size: 10 } }
                    };
                } else {
                    annots[annId].xMin = newTime;
                    annots[annId].xMax = newTime;
                }
                chart.update();

                const valDiv = document.getElementById(`val_${selectedMarker}`);
                const infoDiv = document.getElementById(`info_${selectedMarker}`);
                if (valDiv) valDiv.innerText = newTime.toFixed(4);
                if (infoDiv) infoDiv.innerText = `Fz: ${newFz.toFixed(2)} N (Manual)`;
            }
        }
    });
}
