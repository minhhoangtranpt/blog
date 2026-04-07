let fileContent = '';

// Hàm đọc file .txt
function processFile() {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];

  if (!file || !file.name.endsWith('.txt')) {
    alert('Vui lòng chọn file .txt');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    fileContent = e.target.result.trim();
    document.getElementById('content').innerHTML = `<h2>Nội dung file:</h2><pre>${fileContent}</pre>`;

    calculateExcelFormulas();
  };
  reader.readAsText(file);
}

// Hàm tính toán các công thức Excel
function calculateExcelFormulas() {
  const resultDiv = document.getElementById('result');
  resultDiv.innerHTML = '<h2>Kết quả tính toán:</h2>';

  // Giả sử file .txt chứa nhiều dòng, mỗi dòng là một công thức Excel
  const lines = fileContent.split('\n');

  lines.forEach((line, index) => {
    if (line.trim() === '') return;

    let formula = line.trim();
    
    // Nếu công thức chưa có dấu = thì thêm vào
    if (!formula.startsWith('=')) {
      formula = '=' + formula;
    }

    try {
      // Sử dụng Formula.js để tính
      const result = formulaJS(formula);   // hoặc FormulaJS.evaluate(formula) tùy version

      resultDiv.innerHTML += `
        <p><strong>Dòng ${index + 1}:</strong> ${line} 
        <br>→ Kết quả: <strong>${result}</strong></p>
      `;
    } catch (error) {
      resultDiv.innerHTML += `
        <p><strong>Dòng ${index + 1}:</strong> ${line} 
        <br>→ Lỗi: ${error.message}</p>
      `;
    }
  });
}
