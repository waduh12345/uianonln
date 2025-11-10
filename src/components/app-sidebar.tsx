"use client";

import * as React from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import {
  IconBook,
  IconBrandDatabricks,
  IconDashboard,
  IconDatabase,
  IconFolderQuestion,
  IconLayoutDashboard,
  IconSettings,
  IconUserCog,
  IconUsersGroup,
  IconZoomQuestion,
  type Icon as TablerIcon,
} from "@tabler/icons-react";

import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

/* =========================
 * Types
 * =======================*/
type RoleName = "superadmin" | "pengawas";

type IconType =
  | typeof IconDashboard
  | typeof IconDatabase
  | typeof IconSettings
  | typeof IconUsersGroup
  | TablerIcon; // fallback kalau lib mengekspor `Icon`

type NavChild = {
  title: string;
  url: string;
};

type NavItem = {
  title: string;
  url: string;
  icon: IconType;
  children?: NavChild[];
};

type SecondaryItem = {
  title: string;
  url: string;
  icon: IconType;
};

type MenuBundle = {
  navMain: NavItem[];
  navSecondary: SecondaryItem[];
};

/* =========================
 * Menu by Role
 * =======================*/
const NAV_BY_ROLE: Record<RoleName, MenuBundle> = {
  superadmin: {
    navMain: [
      {
        title: "Dashboard",
        url: "/cms/dashboard",
        icon: IconLayoutDashboard,
      },
      {
        title: "Data Mahasiswa",
        url: "/cms/mahasiswa",
        icon: IconBrandDatabricks,
      },
      {
        title: "LMS",
        url: "/cms/lms",
        icon: IconFolderQuestion,
      },
      {
        title: "Ujian Online",
        url: "/cms/tryout",
        icon: IconZoomQuestion,
      },
      {
        title: "Bank Soal",
        url: "/category-questions",
        icon: IconBook,
        children: [
          { title: "Kategori Soal", url: "/cms/category-questions" },
          { title: "Soal", url: "/cms/questions" },
        ],
      },
      {
        title: "Konfigurasi",
        url: "#",
        icon: IconZoomQuestion,
        children: [
          { title: "Prodi", url: "/cms/prodi" },
          { title: "Jurusan", url: "/cms/jurusan" },
          { title: "Kelas", url: "/cms/class" },
          { title: "Mata Kuliah", url: "/cms/mata-kuliah" },
        ],
      },
      {
        title: "Manajemen User",
        url: "#",
        icon: IconUserCog,
        children: [
          { title: "Users", url: "/cms/users" },
          { title: "Roles", url: "/cms/roles" },
        ],
      },
    ],
    navSecondary: [
      {
        title: "Settings",
        url: "/setting",
        icon: IconSettings,
      },
    ],
  },

  // ⛔ role "pengawas" hanya boleh akses 3 menu berikut:
  pengawas: {
    navMain: [
      {
        title: "Dashboard",
        url: "/dashboard", // gunakan dashboard umum untuk user
        icon: IconDashboard,
      },
      {
        title: "Ujian Online",
        url: "/cms/tryout",
        icon: IconZoomQuestion,
      },
    ],
    navSecondary: [
      {
        title: "Settings",
        url: "/setting",
        icon: IconSettings,
      },
    ],
  },
};

/* =========================
 * Komponen
 * =======================*/
export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = useSession();

  // Ambil role pertama dari session (contoh struktur: session.user.roles[0].name)
  const roleName: RoleName =
    (session?.user as unknown as { roles?: Array<{ name?: string }> })
      ?.roles?.[0]?.name === "superadmin"
      ? "superadmin"
      : "pengawas"; // default aman: user

  const menus = NAV_BY_ROLE[roleName];

  const userForSidebar = {
    name: session?.user?.name ?? "Ujian Online",
    email: session?.user?.email ?? "user@example.com",
    avatar: "/try-out-virtual.webp",
  };

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#">
                <Image
                  src="/try-out-virtual.webp"
                  alt="Ujian Online"
                  width={32}
                  height={32}
                />
                <span className="text-base font-bold">Ujian Online</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={menus.navMain} />
        <NavSecondary items={menus.navSecondary} className="mt-auto" />
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={userForSidebar} />
      </SidebarFooter>
    </Sidebar>
  );
}
