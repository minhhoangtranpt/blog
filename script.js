function processFile() {
    const fileInput = document.getElementById('fileInput');
    const resultDiv = document.getElementById('result');
    
    if (!fileInput.files.length) {
        alert("Vui lòng chọn file .txt trước khi tính toán!");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split(/\r?\n/);
        
        // 1. Tìm dòng bắt đầu của dữ liệu số (sau phần Header)
        let dataStartIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            // Dòng chứa tiêu đề cột thường bắt đầu bằng "Time (s)"
            if (lines[i].includes("Time (s)")) {
                dataStartIndex = i + 1; // Dữ liệu số bắt đầu từ dòng ngay sau tiêu đề
                break;
            }
        }

        if (dataStartIndex === -1) {
            resultDiv.innerHTML = "Lỗi: Không tìm thấy định dạng cột dữ liệu trong file.";
            return;
        }

        // 2. Trích xuất dữ liệu Cột Time (cột 0) và Cột TOTAL Fz (cột 1)
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

        if (timeData.length === 0) {
            resultDiv.innerHTML = "Lỗi: File không có dữ liệu số hợp lệ.";
            return;
        }

        // --- BẮT ĐẦU TÍNH TOÁN CÁC MỐC ---

        // Lấy dữ liệu trong 5 giây đầu để tính trung bình Fz (Baseline)
        const fz5s = fzData.filter((_, index) => timeData[index] <= 5.0);
        const meanFz5s = jStat.mean(fz5s);

        // Lấy dữ liệu trong 10 giây đầu để tính T1
        const indices10s = timeData.map((t, i) => t <= 10.0 ? i : -1).filter(i => i !== -1);
        const fz10s = indices10s.map(i => fzData[i]);

        // --- TÍNH T1: Thời điểm Fz lớn nhất trong 10 giây đầu ---
        const maxFz10s = Math.max(...fz10s);
        const maxIdx10s = fz10s.indexOf(maxFz10s);
        const T1 = timeData[indices10s[maxIdx10s]];

        // --- TÍNH T0: Thời điểm Fz < 2.5% của trung bình 5 giây đầu ---
        const thresholdT0 = 0.025 * meanFz5s;
        let T0 = null;
        for (let i = 0; i < fzData.length; i++) {
            if (fzData[i] < thresholdT0) {
                T0 = timeData[i];
                break; // Dừng lại ở thời điểm đầu tiên thỏa mãn
            }
        }

        // 3. Hiển thị kết quả lên màn hình
        resultDiv.innerHTML = `
            <div class="calculation-box">
                <h2>Kết quả phân tích</h2>
                <p><strong>Trung bình Fz (5s đầu):</strong> ${meanFz5s.toFixed(2)} N</p>
                <p><strong>Ngưỡng xác định T0 (2.5%):</strong> ${thresholdT0.toFixed(2)} N</p>
                <hr>
                <ul>
                    <li><strong>T0:</strong> ${T0 !== null ? T0.toFixed(4) + " (s)" : "Không tìm thấy"}</li>
                    <li><strong>T1:</strong> ${T1.toFixed(4)} (s) <br> <small>(Tại Fz max = ${maxFz10s.toFixed(2)} N)</small></li>
                    <li><em>T2, T3, T4, T5: Đang chờ thiết lập...</em></li>
                </ul>
            </div>
        `;
    };

    reader.readAsText(file);
}
