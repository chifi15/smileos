"use client";

import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download, X } from "lucide-react";

interface Props {
  url: string;
  onClose: () => void;
}

export default function QrModal({ url, onClose }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);

  function handleDownload() {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "enlace-reserva-qr.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xs rounded-2xl bg-white dark:bg-gray-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-gray-700">
          <h3 className="font-semibold text-slate-800 dark:text-white">QR de reserva online</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-300">
            <X size={18} />
          </button>
        </div>

        {/* QR */}
        <div className="flex flex-col items-center gap-4 px-6 py-6">
          <div ref={canvasRef} className="rounded-xl p-3 bg-white shadow-sm border border-slate-100">
            <QRCodeCanvas
              value={url}
              size={220}
              bgColor="#ffffff"
              fgColor="#0f172a"
              level="M"
              marginSize={1}
            />
          </div>
          <p className="text-xs text-slate-400 dark:text-gray-500 text-center break-all">{url}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            <Download size={15} />
            Descargar PNG
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 dark:border-gray-600 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
