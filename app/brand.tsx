import Image from "next/image";
import lptqLogo from "@/public/logo-lptq.png";
import kemenagLogo from "@/public/logo-kemenag.png";
import pemkabLogo from "@/public/logo-pemkab-kutai-barat.png";

export default function Brand({ login = false }: { login?: boolean }) {
  return (
    <div className={`brand${login ? " brand-login" : ""}`}>
      {login ? (
        <div className="login-logos">
          <Image
            src={kemenagLogo}
            alt="Logo Kementerian Agama"
            sizes="(min-width: 700px) 104px, 80px"
            preload
          />
          <Image
            src={lptqLogo}
            alt="Logo LPTQ Kabupaten Kutai Barat"
            sizes="(min-width: 700px) 104px, 80px"
            preload
          />
          <Image
            src={pemkabLogo}
            alt="Logo Pemerintah Kabupaten Kutai Barat"
            sizes="(min-width: 700px) 104px, 80px"
            preload
          />
        </div>
      ) : (
        <Image
          src={lptqLogo}
          alt="Logo LPTQ Kabupaten Kutai Barat"
          className="brand-logo"
          sizes="44px"
          preload
        />
      )}
      <div className="brand-name">
        <strong>e-MTQ</strong>
        <span>LPTQ Kubar</span>
      </div>
    </div>
  );
}
