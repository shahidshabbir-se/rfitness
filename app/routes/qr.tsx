import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { useEffect, useRef } from "react";
import { requireAdmin } from "~/utils/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // Require admin authentication
  await requireAdmin(request);
  return json({});
}

export default function QRCode() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrImageRef = useRef<HTMLImageElement>(null);
  
  useEffect(() => {
    // This would be replaced with a real QR code generation library in production
    // For now, we'll just simulate a QR code with a placeholder image
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw a placeholder QR code
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 300, 300);
        
        ctx.fillStyle = 'black';
        // Draw border
        ctx.fillRect(0, 0, 300, 30);
        ctx.fillRect(0, 0, 30, 300);
        ctx.fillRect(270, 0, 30, 300);
        ctx.fillRect(0, 270, 300, 30);
        
        // Draw position detection patterns
        ctx.fillRect(50, 50, 80, 80);
        ctx.fillRect(170, 50, 80, 80);
        ctx.fillRect(50, 170, 80, 80);
        
        // Draw white squares inside position detection patterns
        ctx.fillStyle = 'white';
        ctx.fillRect(65, 65, 50, 50);
        ctx.fillRect(185, 65, 50, 50);
        ctx.fillRect(65, 185, 50, 50);
        
        // Draw black squares inside white squares
        ctx.fillStyle = 'black';
        ctx.fillRect(80, 80, 20, 20);
        ctx.fillRect(200, 80, 20, 20);
        ctx.fillRect(80, 200, 20, 20);
        
        // Draw some random modules to make it look like a QR code
        for (let i = 0; i < 100; i++) {
          const x = Math.floor(Math.random() * 240) + 30;
          const y = Math.floor(Math.random() * 240) + 30;
          const size = Math.floor(Math.random() * 10) + 5;
          ctx.fillRect(x, y, size, size);
        }
        
        // Add text to indicate this is for check-in
        ctx.font = '14px Arial';
        ctx.fillStyle = 'black';
        ctx.fillText('Scan to check in', 100, 150);
        
        // Update the image reference for download
        if (qrImageRef.current) {
          qrImageRef.current.src = canvas.toDataURL('image/png');
        }
      }
    }
  }, []);
  
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const link = document.createElement('a');
      link.download = 'gym-checkin-qr.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-gray-800">Check-in QR Code</h1>
          <p className="mt-2 text-gray-600">Display this QR code for members to scan</p>
        </div>
        
        <div className="flex flex-col items-center">
          <canvas 
            ref={canvasRef} 
            width={300} 
            height={300} 
            className="mb-4 rounded-lg border border-gray-200 shadow-sm"
          />
          
          <img 
            ref={qrImageRef} 
            alt="QR Code" 
            className="hidden" // Hidden, just used for download
          />
          
          <button
            onClick={handleDownload}
            className="mt-4 flex items-center rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download QR Code
          </button>
        </div>
        
        <div className="mt-8 flex justify-center space-x-4">
          <Link 
            to="/admin" 
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Admin
          </Link>
          <Link 
            to="/" 
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
