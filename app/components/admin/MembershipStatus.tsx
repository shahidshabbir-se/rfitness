interface MembershipStatusProps {
  activeMembers: number;
  needsRenewal: number;
}

export default function MembershipStatus({ activeMembers, needsRenewal }: MembershipStatusProps) {
  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold text-gray-800">Membership Status Tracking</h2>
      
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg bg-green-50 p-4 text-center">
          <h3 className="text-sm font-medium text-gray-500">Active Members</h3>
          <p className="mt-2 text-3xl font-bold text-green-600">{activeMembers}</p>
        </div>
        
        <div className="rounded-lg bg-yellow-50 p-4 text-center">
          <h3 className="text-sm font-medium text-gray-500">Needs Renewal</h3>
          <p className="mt-2 text-3xl font-bold text-yellow-600">{needsRenewal}</p>
        </div>
        
        <div className="rounded-lg bg-blue-50 p-4 text-center">
          <h3 className="text-sm font-medium text-gray-500">Total Members</h3>
          <p className="mt-2 text-3xl font-bold text-blue-600">
            {activeMembers + needsRenewal}
          </p>
        </div>
      </div>
      
      <div className="mt-6">
        <h3 className="mb-3 text-lg font-medium text-gray-800">Members Needing Renewal</h3>
        
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Member
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Phone
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Membership Type
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Expiry Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {/* Mock data for members needing renewal */}
              <tr>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                  Alex Johnson
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  +44 770 123 4567
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  Monthly Subscription (£25)
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  <span className="inline-flex rounded-full bg-red-100 px-2 text-xs font-semibold leading-5 text-red-800">
                    Expired
                  </span>
                </td>
              </tr>
              <tr>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                  Emma Wilson
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  +44 770 234 5678
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  Cash Payment (£30)
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  <span className="inline-flex rounded-full bg-yellow-100 px-2 text-xs font-semibold leading-5 text-yellow-800">
                    Expiring Soon
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
