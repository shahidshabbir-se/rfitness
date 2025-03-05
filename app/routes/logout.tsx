import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { logoutAdmin } from "~/utils/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  return logoutAdmin(request);
}

export async function action({ request }: ActionFunctionArgs) {
  return logoutAdmin(request);
}
