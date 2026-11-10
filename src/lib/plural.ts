const PR = new Intl.PluralRules("ro");

/** Romanian plural with "de" from 20 on: nr(1, "anunț", "anunțuri") = "1 anunț", nr(5, …) = "5 anunțuri", nr(25, …) = "25 de anunțuri". */
export const nr = (n: number, one: string, many: string) => {
  const k = PR.select(n);
  return k === "one" ? `${n} ${one}` : k === "other" ? `${n} de ${many}` : `${n} ${many}`;
};
