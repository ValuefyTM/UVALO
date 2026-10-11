import { redirect } from "next/navigation";

// The cadastral plans moved to the settings of the cadastral locator (Admin → Instrumente → Localizator cadastral).
export default function Planuri() {
  redirect("/admin/instrumente/localizare#planuri");
}
