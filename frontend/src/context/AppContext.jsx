import { createContext } from 'react';

// Se declara fuera de App para evitar dependencias circulares con las páginas
// cargadas de forma diferida (Login, Facturación y otros módulos).
export const AppContext = createContext(null);
