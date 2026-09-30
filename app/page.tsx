// Halaman utama aplikasi. Merender AppShell yang merakit navigasi mode
// (Estimasi/Konfigurasi) beserta stepper dan seluruh komponen fitur.
// ConfigProvider dibungkus di app/layout.tsx sehingga context tersedia di sini.
import { AppShell } from "../components/AppShell";

export default function HomePage() {
  return (
    <main>
      <AppShell />
    </main>
  );
}
