sap.ui.define([], function () {
  "use strict";

  const NS = "urn:iso:std:iso:20022:tech:xsd:pain.001.001.03";

  return {
    convert: function (xmlString, pagosValidos) {

      /* ========================================= */
      /* Parse XML                                 */
      /* ========================================= */

      const parser = new DOMParser();
      const xml = parser.parseFromString(xmlString, "application/xml");

      /* ========================================= */
      /* Helpers (misma estructura que INTER)      */
      /* ========================================= */

      const clean = (v) =>
        String(v || "")
          .replace(/[\r\n\t]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();

      const padLeft = (v, l, ch = "0") =>
        String(v || "").padStart(l, ch).substring(0, l);

      const padRight = (v, l, ch = " ") =>
        String(v || "").padEnd(l, ch).substring(0, l);

      const qPath = (node, path) => {
        let n = node;
        for (const tag of path) {
          n = n?.getElementsByTagNameNS(NS, tag)?.[0];
        }
        return clean(n?.textContent || "");
      };

      const q = (node, tag) =>
        clean(node.getElementsByTagNameNS(NS, tag)?.[0]?.textContent);

      const mapCurrency = (currency) => {

      const cur = String(currency || "").toUpperCase();

      switch (cur) {
        case "MXN":
          return "001";
        case "USD":
          return "002"; // o 005 si el banco lo pide así
        case "EUR":
          return "003";
        default:
          return "001"; // fallback seguro
      }
    };

      /* ========================================= */
      /* Datos globales                            */
      /* ========================================= */

      const msgId = q(xml, "MsgId");

      // Cuenta ORIGEN (misma idea que INTER)
      let cuentaOrigenRaw =
        qPath(xml, ["DbtrAcct", "Id", "Othr", "Id"]);

          if (cuentaOrigenRaw === "07500010341") {
            cuentaOrigenRaw = "00000010341";
          };  
      const cuentaOrigen =
        padLeft((cuentaOrigenRaw || "").replace(/\D/g, ""), 20);


      let lines = [];

      /* ========================================= */
      /* SOLO pagos válidos (POBox = BX)           */
      /* ========================================= */

      (pagosValidos || []).forEach(obj => {

        const p = obj.xmlNode;

        /* =============================== */
        /* Datos APIs                      */
        /* =============================== */

        const branch = padLeft(obj.branch, 4);   // API 1
        const holder = clean(obj.holder || "");  // API 3
        const currency = clean(obj.currency || "");

        /* =============================== */
        /* Datos del XML que se muestran en la VIEW                  */
        /* =============================== */

        const cuentaDestino = padLeft(qPath(p, ["CdtrAcct", "Id", "Othr", "Id"]).replace(/\D/g, ""),20);
       

        const importe = padLeft(
          q(p, "InstdAmt").replace(".", ""),
          14
        );

        const concepto = padRight(
          qPath(p, ["RmtInf", "Ustrd"]) ||
          "Pago a terceros",
          34
        );


        const numAsiento = padLeft(qPath(p, ["PmtId", "EndToEndId"]));
        /* =============================== */
        /* LAYOUT (NO MODIFICADO)          */
        /* =============================== */

        const tipoTransaccion = "03";
        const tipoCuentaOrigen = "01";
        const sucursalOrigen = branch;

        const tipoCuentaDestino = "01";
        const sucursalDestino = holder;

        const tipoMoneda = mapCurrency(currency);

        const descripcion = padRight(
          `Pago ${msgId}`,
          24
        );

        const referencia = padLeft("", 10);
        const moneda = "000";
        const fechaAplicacion = "000000";
        const horaAplicacion = "0000";

        const beneficiario = padRight(holder, 55);

        /* =============================== */
        /* Construcción final              */
        /* =============================== */

        const line =
          tipoTransaccion +
          tipoCuentaOrigen +
          sucursalOrigen +
          cuentaOrigen +
          tipoCuentaDestino +
          sucursalDestino +
          cuentaDestino +
          importe +
          tipoMoneda +
          descripcion +
          concepto +
          numAsiento +
          moneda +
          fechaAplicacion +
          horaAplicacion;

        lines.push(line);
      });

      return lines.join("\n");
    }
  };
});