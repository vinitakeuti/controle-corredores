import QRCode from "qrcode";

// QR Code em SVG, gerado na renderização (sem rede, sem canvas). Sempre preto
// no branco e com margem de 4 módulos, como a especificação pede, para a
// câmera ler bem também no tema escuro.
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
  const margin = 4;
  const side = modules.size + margin * 2;
  let path = "";
  for (let row = 0; row < modules.size; row += 1) {
    for (let col = 0; col < modules.size; col += 1) {
      if (modules.data[row * modules.size + col]) path += `M${col + margin} ${row + margin}h1v1h-1z`;
    }
  }
  return <svg className={["qr-code", className].filter(Boolean).join(" ")} role="img" aria-label={label} viewBox={`0 0 ${side} ${side}`} shapeRendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
    <rect width={side} height={side} fill="#ffffff" />
    <path d={path} fill="#000000" />
  </svg>;
}

// Bloco padrão para mostrar um link como QR Code: o código, quem escaneia e o que acontece.
export function QrPanel({ value, label, title, children }: { value: string; label: string; title: string; children?: React.ReactNode }) {
  return <figure className="qr-panel">
    <QrCode value={value} label={label} />
    <figcaption className="qr-panel-copy">
      <strong>{title}</strong>
      {children}
    </figcaption>
  </figure>;
}
