// import type { Metadata } from "next";
// import "./globals.css";
// import TopNav from "@/components/TopNav";

// export const metadata: Metadata = {
//   title: "Study Mode — Visual Learning",
//   description: "AI-powered visual notes for visual learners",
// };

// export default function RootLayout({ children }: { children: React.ReactNode }) {
//   return (
//     <html lang="en">
//       <body>
//         <TopNav />
//         {children}
//       </body>
//     </html>
//   );
// }
 
import "./globals.css";
import type { Metadata } from "next";
import TopNav from "@/components/TopNav";
import { LockdownProvider } from "@/components/lockdown/LockdownProvider";


export const metadata: Metadata = {
  title: "Study Mode — Visual Learning",
  description: "AI-powered visual notes for visual learners",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LockdownProvider>
          <TopNav />
          {children}
        </LockdownProvider>
      </body>
    </html>
  );
}