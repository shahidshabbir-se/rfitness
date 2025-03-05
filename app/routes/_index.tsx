import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { isDevelopment } from "~/utils/env.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Gym Check-in System" },
    { name: "description", content: "Check in to your gym with a QR code" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  return json({
    showAdminLink: isDevelopment()
  });
}

export default function Index() {
  const data = useLoaderData<typeof loader>();
  const showAdminLink = data?.showAdminLink ?? false;
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-gray-800">Gym Check-in</h1>
          <p className="mt-2 text-gray-600">Welcome to our gym check-in system</p>
        </div>
        
        <div className="space-y-4">
          <Link 
            to="/check-in"
            className="block w-full rounded-lg bg-blue-600 px-4 py-3 text-center font-medium text-white transition hover:bg-blue-700"
          >
            Check In Now
          </Link>
          
          {showAdminLink && (
            <Link 
              to="/admin-login"
              className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-center font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Admin Portal
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
