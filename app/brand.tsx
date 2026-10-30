import Image from "next/image";
import lptqLogo from "@/public/logo-lptq.png";

export default function Brand() {
  return (
    <div className="brand">
      <Image
        src={lptqLogo}
        alt="Logo LPTQ Kabupaten Kutai Barat"
        className="brand-logo"
        sizes="44px"
        preload
      />
      <div className="brand-name">
        <strong>e-MTQ</strong>
        <span>LPTQ Kubar</span>
      </div>
    </div>
  );
}
