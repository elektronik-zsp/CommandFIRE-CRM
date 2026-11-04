// File → base64 (without the data: prefix), for JSON uploads to the API.
export const readBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.onerror = () => reject(new Error('Nie udało się odczytać pliku'));
  r.readAsDataURL(file);
});
