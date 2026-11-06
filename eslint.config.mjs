import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "public/**", "next-env.d.ts"] },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // eslint-config-next 16 embarque eslint-plugin-react-hooks v7. Ces deux
      // règles signalent des motifs déjà présents dans l'app (synchronisation
      // d'état dérivé depuis une action ou des props dans un effet). On les
      // garde en avertissement le temps d'un refactor dédié, plutôt que de
      // bloquer la montée Next 16.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
];

export default eslintConfig;
