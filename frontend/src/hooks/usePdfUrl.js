export function pdfUrl(path) {
  const token = localStorage.getItem('phm_token');
  return `${path}${path.includes('?') ? '&' : '?'}token=${token}`;
}
