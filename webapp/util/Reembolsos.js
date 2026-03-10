sap.ui.define([], function () {
  "use strict";

  const NS = "urn:iso:std:iso:20022:tech:xsd:pain.001.001.03";

  return {

    convert: function (xmlString, pagosValidos) {

      /* ===============================
       * Parse XML
       * =============================== */

      const parser = new DOMParser();
      const xml = parser.parseFromString(xmlString, "application/xml");

      /* ===============================
       * Helpers
       * =============================== */

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

      const msgId = q(xml, "MsgId");

      const cuentaOrigenRaw =
        qPath(xml, ["DbtrAcct", "Id", "Othr", "Id"]);

      const cuentaOrigen =
        padLeft((cuentaOrigenRaw || "").replace(/\D/g, ""), 20);

      let lines = [];

      /* ===============================
       * SOLO PAGOS VALIDOS (REEM)
       * =============================== */

      (pagosValidos || []).forEach(obj => {

        const p = obj.xmlNode;

        /* ===============================
         * Datos APIs
         * =============================== */

        const branch = padLeft(obj.branch, 4);
        const holder = clean(obj.holder || "");
        const currency = clean(obj.currency || "");

        /* ===============================
         * Datos XML
         * =============================== */

        const cuentaDestino = padLeft(
          qPath(p, ["CdtrAcct", "Id", "Othr", "Id"]).replace(/\D/g, ""),
          20
        );

        const importe = padLeft(
          q(p, "InstdAmt").replace(".", ""),
          14
        );

        const concepto = padRight(
          qPath(p, ["RmtInf", "Ustrd"]) || "Pago reembolso",
          34
        );

        const numAsiento = padLeft(
          qPath(p, ["PmtId", "EndToEndId"]),10);

        /* ===============================
         * Layout
         * =============================== */

        const tipoTransaccion = "03";
        const tipoCuentaOrigen = "01";
        const sucursalOrigen = branch;

        const tipoCuentaDestino = "01";
        const sucursalDestino = holder;

        const tipoMoneda = "001";

        const descripcion = padRight(
          `Reembolso ${msgId}`,
          24
        );

        const moneda = "000";
        const fechaAplicacion = "000000";
        const horaAplicacion = "0000";

        /* ===============================
         * Construcción
         * =============================== */

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