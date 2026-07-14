const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/ReportPreviewModal.jsx', 'utf8');

code = code.replace(
  'const handleDownloadPDF = () => {', 
  "const handleDownloadPDF = (action = 'download') => {"
);

code = code.replace(
  /doc\.save\(\`(.*?)\`\);/g,
  `if (action === 'print') {
        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
      } else {
        doc.save(\`$1\`);
      }`
);

code = code.replace(
  /const handlePrint = \(\) => \{\s*if \(reportType === 'libro'\) \{\s*const doc = generateLibroDoc\(\);\s*doc\.autoPrint\(\);\s*const blobUrl = doc\.output\('bloburl'\);\s*window\.open\(blobUrl, '_blank'\);\s*\} else \{\s*window\.print\(\);\s*\}\s*\};/,
  `const handlePrint = () => {
    handleDownloadPDF('print');
  };`
);

fs.writeFileSync('frontend/src/components/ReportPreviewModal.jsx', code);
