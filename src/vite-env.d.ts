/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FACULTY_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
