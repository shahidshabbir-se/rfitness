import { json, type ActionFunction } from "@remix-run/node";
import { getEnv } from "~/utils/env.server";

export const action: ActionFunction = async ({ request }) => {
  const env = getEnv();
  console.log("env", env.SECURE_API_KEY);

  // ✅ Check for Authorization Header
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || authHeader !== `Bearer ${env.SECURE_API_KEY}`) {
    return json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch(
      "https://connect.squareup.com/v2/customers/search",
      {
        method: "POST",
        headers: {
          //   Authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
          Authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: {} }),
      }
    );

    const data = await response.json();
    if (!data.customers) return json({ members: [] });

    const members = data.customers.map((customer: any) => ({
      id: customer.id,
      name: customer.given_name,
      email: customer.email_address,
      phoneNumber: customer.phone_number,
    }));

    return json({ success: true, members });
  } catch (error) {
    console.error("Error fetching members:", error);
    return json(
      { success: false, message: "Failed to retrieve members" },
      { status: 500 }
    );
  }
};
