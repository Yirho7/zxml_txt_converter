sap.ui.define([], function () {
  "use strict";

  const NS = "urn:iso:std:iso:20022:tech:xsd:pain.001.001.03";

  return {
    convert: function (xmlString, pagosValidos) {

      const parser = new DOMParser();
      const xml = parser.parseFromString(xmlString, "application/xml");

      const clean = (v) =>
        String(v || "")
          .replace(/[\r\n\t]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();

      const padLeft = (v, l, ch = "0") =>
        String(v || "").padStart(l, ch).substring(0, l);

      const padRight = (v, l, ch = " ") =>
        String(v || "").padEnd(l, ch).substring(0, l);

      // get by path tags using namespace
      const qPath = (node, path) => {
        let n = node;
        for (const tag of path) {
          n = n?.getElementsByTagNameNS(NS, tag)?.[0];
        }
        return clean(n?.textContent || "");
      };

      // MsgId global
      const msgId = clean(xml.getElementsByTagNameNS(NS, "MsgId")[0]?.textContent || "");

      // Cuenta ORIGEN: DbtrAcct/Id/Othr/Id 
      let cuentaOrigenRaw = qPath(xml, ["DbtrAcct", "Id", "Othr", "Id"]); // ej: 002180075097500385
      if (cuentaOrigenRaw === "07500010341") {
            cuentaOrigenRaw = "00000010341";
          };
      const cuentaOrigen = padLeft(cuentaOrigenRaw.replace(/\D/g, ""), 20);

      let lines = [];

      (pagosValidos || []).forEach(obj => {
        const p = obj.xmlNode;
        const refNbPago = qPath(p, ["Tax", "RefNb"]);

        // Datos de APIs 
        const branch = padLeft(obj.branch, 4);       // LongBankBranch (API1)
        const holder = clean(obj.holder);            // BankAccountHolderName (API3)
        const currency = clean(obj.currency);        // BankAccountName (API3)

        // Cuenta DESTINO CdtrAcct/Id/Othr/Id
        const cuentaDestinoRaw = qPath(p, ["CdtrAcct", "Id", "Othr", "Id"]);
        const cuentaDestino = padLeft(cuentaDestinoRaw.replace(/\D/g, ""), 20);

        // Beneficiario Cdtr/Nm
        const beneficiario = padRight(qPath(p, ["Cdtr", "Nm"]), 55);

        // RFC Tax/Dbtr/TaxId
        const rfc = padRight(qPath(p, ["Tax", "Dbtr", "TaxId"]), 14);

        // Importe Amt/InstdAmt
        const importeRaw = qPath(p, ["Amt", "InstdAmt"]);       // "33196.11"
        const importe = padLeft(importeRaw.replace(".", ""), 14);

        // Descripción 
        //const descripcion = padRight(`Pago Factura: ${RefNb}`, 40);
        const descripcion = padRight(`Pago Factura: ${refNbPago}`, 40);

        // Numero de Asiento
        const numAsiento = padLeft(qPath(p, ["PmtId", "EndToEndId"]).slice(-7),7);

        // ===== Layout estructura base =====
        const tipoTransaccion = "09";
        const tipoCuentaOrigen = "01";
        const sucursalOrigen = branch;    
        const moneda = "001";
        const tipoCuentaDestino = "40";
        
        const plazo = "00";
        const iva = padLeft("0", 12);
        const banco = "0021";
        const fechaAplicacion = "000000";
        const horaAplicacion = "0000";


        const line =
          tipoTransaccion +
          tipoCuentaOrigen +
          sucursalOrigen +
          cuentaOrigen +
          importe +
          moneda +
          tipoCuentaDestino +
          cuentaDestino +
          descripcion +
          numAsiento +
          beneficiario +
          plazo +
          rfc +
          iva +
          banco +
          fechaAplicacion +
          horaAplicacion;

        lines.push(line);
      });

      return lines.join("\n");
    }
  };
});