import "./globals.css";

export const metadata = {
  title: "Yeison HC Barber",
  description: "Sistema de gestión y reservas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="bg-black text-zinc-100 antialiased min-h-screen selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}