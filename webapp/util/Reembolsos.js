sap.ui.define([], function () {
  "use strict";

  return {

    convert: function (xmlString) {

      /* ===============================
       * Helpers
       * =============================== */
      const padLeft = (v, l, ch = "0") =>
        String(v || "").padStart(l, ch).substring(0, l);

      const padRight = (v, l, ch = " ") =>
        String(v || "").padEnd(l, ch).substring(0, l);

      const clean = (v) =>
        String(v || "")
          .replace(/[\r\n\t]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();

      const qPath = (node, path) => {
        let n = node;
        for (const tag of path) {
          n = n?.getElementsByTagNameNS(ns, tag)?.[0];
        }
        return clean(n?.textContent || "");
      };

      /* ===============================
       * Parse XML
       * =============================== */
      const parser = new DOMParser();
      const xml = parser.parseFromString(xmlString, "application/xml");

      const ns = "urn:iso:std:iso:20022:tech:xsd:pain.001.001.03";
      const q = (node, tag) =>
        clean(node.getElementsByTagNameNS(ns, tag)[0]?.textContent);

      const pagos = xml.getElementsByTagNameNS(ns, "CdtTrfTxInf");
      const msgId = q(xml, "MsgId");

      let lines = [];

      for (let p of pagos) {

        /* ===============================
         * LAYOUT PAGOS A TERCEROS
         * =============================== */

        const tipoTransaccion = "RE";                 // 01–02   Tipo de Transacción
        const tipoCuentaOrigen = "RE";                // 03–04   Tipo de Cuenta Origen (Cheques)
        const sucursalOrigen = "0750";                // 05–08   Sucursal Cuenta Origen

        const cuentaOrigen = padLeft(
          q(xml, "DbtrAcct").match(/\d+/)?.[0],
          20
        );                                            // 09–28   Cuenta Origen

        const tipoCuentaDestino = "01";               // 29–30   Tipo de Cuenta Destino
        const sucursalDestino = "0000";               // 31–34   Sucursal Cuenta Destino

        const cuentaDestino = padLeft(
          qPath(p, ["CdtrAcct", "Id", "Othr", "Id"]),
          20
        );                                            // 35–54   Cuenta Destino

        const importe = padLeft(
          q(p, "InstdAmt").replace(".", ""),
          14
        );                                            // 55–68   Importe

        const tipoMoneda = "001";                     // 69–71   Tipo de moneda

        const descripcion = padRight(
          `Pago ${msgId}`,
          24
        );                                            // 72–95   Descripción

        const concepto = padRight(
          qPath(p, ["RmtInf", "Ustrd"]) || "Pago a terceros",
          34
        );                                            // 96–129  Concepto

        const referencia = padLeft("", 10);           // 130–139 Referencia
        const moneda = "000";                         // 140–142 Moneda
        const fechaAplicacion = "000000";             // 143–148 Fecha de Aplicación
        const horaAplicacion = "0000";                // 149–152 Hora de Aplicación

        /* ===============================
         * CONSTRUCCIÓN FINAL
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
          referencia +
          moneda +
          fechaAplicacion +
          horaAplicacion;

        lines.push(line);
      }

      return lines.join("\n");
    }
  };
});
