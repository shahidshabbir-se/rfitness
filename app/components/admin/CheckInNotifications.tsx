import { useState, useEffect } from "react";
import type { CheckInRecord } from "~/types";

interface CheckInNotificationsProps {
  notifications: CheckInRecord[];
}

export default function CheckInNotifications({
  notifications,
}: CheckInNotificationsProps) {
  const [showNotifications, setShowNotifications] = useState(false);

  // Auto-show notifications when new ones arrive
  useEffect(() => {
    if (notifications.length > 0) {
      setShowNotifications(true);

      // Auto-hide after 10 seconds
      const timer = setTimeout(() => {
        setShowNotifications(false);
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [notifications]);

  if (notifications.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-800">Recent Check-ins</h2>
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {showNotifications ? "Hide" : "Show"} ({notifications.length})
        </button>
      </div>

      {showNotifications && (
        <div className="mt-3 space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`flex items-center rounded-lg border p-4 ${
                notification.success
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <div
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                  notification.success
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {notification.initials}
              </div>
              <div className="ml-4 flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900">
                    {notification.customerName}
                  </p>
                  <span className="text-sm text-gray-500">
                    {new Date(notification.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p
                  className={`text-sm ${notification.success ? "text-green-700" : "text-red-700"}`}
                >
                  {notification.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
