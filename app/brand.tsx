import Image from "next/image";
import kemenagLogo from "@/public/logo-kemenag.png";

export default function Brand() {
  return (
    <div className="brand">
      <Image
        src={kemenagLogo}
        alt="Logo Kementerian Agama"
        className="brand-logo"
        sizes="44px"
        preload
      />
      <div className="brand-name">
        <strong>e-MTQ</strong>
        <span>Kemenag Kubar</span>
      </div>
    </div>
  );
}
