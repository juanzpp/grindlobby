import Dashboard from "@/components/Dashboard";
import ProfileEditorModal from "@/components/profile/ProfileEditorModal";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function EditProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05060a]">
      <div aria-hidden="true" className="pointer-events-none select-none opacity-55 blur-[7px] saturate-[0.7]">
        <Dashboard user={user} />
      </div>
      <div aria-hidden="true" className="fixed inset-0 z-[80] bg-[#02030a]/64 backdrop-blur-[5px]" />
      <ProfileEditorModal />
    </div>
  );
}
