import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { requireAdmin } from "~/utils/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // Require admin authentication
  await requireAdmin(request);
  return json({});
}

export default function QRCode() {
  const handleDownload = () => {
    // Create a link element and trigger download of the static QR code
    const link = document.createElement('a');
    link.download = 'gym-checkin-qr.png';
    link.href = `/gym-checkin-qr.png?t=${Date.now()}`; // Add cache-busting parameter
    link.click();
  };
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-gray-800">Check-in QR Code</h1>
          <p className="mt-2 text-gray-600">Display this QR code for members to scan</p>
        </div>
        
        <div className="flex flex-col items-center">
          {/* Display the static QR code image */}
          <img 
            src={`/gym-checkin-qr.png?t=${Date.now()}`} // Add cache-busting parameter
            alt="Check-in QR Code" 
            width={300} 
            height={300} 
            className="mb-4 rounded-lg border border-gray-200 shadow-sm"
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
