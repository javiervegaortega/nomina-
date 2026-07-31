let workerInstance;
let nextRequestId = 1;
const requests = new Map();

const getWorker = () => {
  if (workerInstance) return workerInstance;
  workerInstance = new Worker(
    new URL('../workers/excel.worker.js', import.meta.url),
    { type: 'module' }
  );
  workerInstance.onmessage = ({ data }) => {
    const request = requests.get(data.id);
    if (!request) return;
    requests.delete(data.id);
    if (data.error) request.reject(new Error(data.error));
    else request.resolve(data.buffer);
  };
  workerInstance.onerror = (event) => {
    requests.forEach(({ reject }) => reject(new Error(event.message || 'Error en el generador Excel')));
    requests.clear();
    workerInstance.terminate();
    workerInstance = null;
  };
  return workerInstance;
};

export const generateExcelBuffer = (type, payload) => new Promise((resolve, reject) => {
  const id = nextRequestId++;
  requests.set(id, { resolve, reject });
  getWorker().postMessage({ id, type, payload });
});

export const downloadExcelBuffer = (buffer, filename) => {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export const generateAndDownloadExcel = async (type, payload, filename) => {
  const buffer = await generateExcelBuffer(type, payload);
  downloadExcelBuffer(buffer, filename);
};
