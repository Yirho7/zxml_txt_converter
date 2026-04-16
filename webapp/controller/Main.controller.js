sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/ui/core/util/File",
  "zxmltxt/zxmltxtconverter/util/Interbancarios",
  "zxmltxt/zxmltxtconverter/util/Terceros",
  "zxmltxt/zxmltxtconverter/util/Reembolsos"
], function (
  Controller,
  MessageToast,
  FileUtil,
  Interbancarios,
  Terceros,
  Reembolsos
) {
  "use strict";

  const NS = "urn:iso:std:iso:20022:tech:xsd:pain.001.001.03";

  return Controller.extend("zxmltxt.zxmltxtconverter.controller.Main", {

    /* ========================================================= */
    /* INIT */
    /* ========================================================= */
      onInit: function () {
        this._xmlFile = null;
        this._txtContent = "";
      },

    /* ========================================================= */
    /* FILE */
    /* ========================================================= */
    onFileChange: function (oEvent) {

      const files = oEvent.getParameter("files");
      this._xmlFile = (files && files.length) ? files[0] : null;

      this._txtContent = "";
      this.byId("taTxt").setValue("");
      this.byId("btnDownload").setEnabled(false);

      if (this._xmlFile) {
        MessageToast.show("XML seleccionado: " + this._xmlFile.name);
      }

    },

    /* ========================================================= */
    /* API HELPERS */
    /* ========================================================= */

    _getBankData: async function (bankId) {

      const oModel = this.getView().getModel("bankModel");
      if (!oModel) throw new Error("bankModel no existe");

      const path = `/Bank(BankCountry='MX',BankInternalID='${bankId}')`;

      const ctx = oModel.bindContext(path);
      const data = await ctx.requestObject();
      

      return {
        branch: data?.LongBankBranch || ""
      };

    },

    _readV2: function (sPath) {

      return new Promise((resolve, reject) => {

        const oModel = this.getView().getModel("bpModel");

        if (!oModel) {
          reject(new Error("bpModel no existe"));
          return;
        }

        oModel.read(sPath, {
          success: resolve,
          error: reject
        });

      });

    },

    /* ========================================================= */
    /* EXTRAER RFC DESDE XML */
    /* ========================================================= */

    _getTaxIdFromPayment: function (paymentNode) {

      const taxId =
        paymentNode
          .getElementsByTagNameNS(NS, "Tax")[0]
          ?.getElementsByTagNameNS(NS, "Dbtr")[0]
          ?.getElementsByTagNameNS(NS, "TaxId")[0]
          ?.textContent
          ?.trim() || "";
      console.log("TaxId FINAL =>", taxId);
      return taxId;

    },

    /* ========================================================= */
    /* EXTRAER NOMBRE DESDE XML */
    /* ========================================================= */

    _getNameFromPayment: function (paymentNode) {

      const name =
        paymentNode
          .getElementsByTagNameNS(NS, "Cdtr")[0]
          ?.getElementsByTagNameNS(NS, "Nm")[0]
          ?.textContent
          ?.trim() || "";

      return name;

    },

    /* ========================================================= */
    /* BUSCAR BP POR NOMBRE */
    /* ========================================================= */

    _resolveBPFromName: async function (nameRaw) {

      const oModel = this.getView().getModel("bpModel");

      const name = (nameRaw || "").trim();

      if (!name) return null;

      try {

        const oData = await new Promise((resolve, reject) => {

          oModel.read("/A_BusinessPartner", {
            urlParameters: {
              "$filter": `BusinessPartnerFullName eq '${name}'`
            },
            success: resolve,
            error: reject
          });

        });

        const results = oData?.results || [];

        if (!results.length) return null;
       // console.log(results[0]);
        return results[0].BusinessPartner;
         

      } catch (e) {

        console.error("[API NAME ERROR]", e);
        return null;

      }

    },

    /* ========================================================= */
    /* BUSCAR BP POR RFC */
    /* ========================================================= */

    _resolveBPFromTaxId: async function (taxIdRaw) {

      const oModel = this.getView().getModel("bpModel");

      const taxId = (taxIdRaw || "").trim().toUpperCase();
      if (!taxId) return null;

      try {

        const oData = await new Promise((resolve, reject) => {

          oModel.read("/A_BusinessPartnerTaxNumber", {
            urlParameters: {
              "$filter": `BPTaxNumber eq '${taxId}'`
            },
            success: resolve,
            error: reject
          });

        });

        const results = oData?.results || [];

        if (!results.length) return null;
       // console.log(results[0]);
        const mx1 = results.find(r => r.BPTaxType === "MX1");

        const bp = mx1 ? mx1.BusinessPartner : results[0].BusinessPartner;

        return bp;

      } catch (e) {

        console.error("[API TAX ERROR]", e);
        return null;

      }

    },

    /* ========================================================= */
    /* API ADDRESS */
    /* ========================================================= */

    _getBPAddressWithPOBox: async function (bp) {

      const path = `/A_BusinessPartner('${bp}')/to_BusinessPartnerAddress`;

      try {

        const oData = await this._readV2(path);
        const list = oData?.results || [];
       // console.log(list);
        const withPOBox = list.find(x =>
          (x.POBox || x.PoBox || "").trim() !== ""
        );

        if (!withPOBox && list.length) {
          return { __exists: true, __poBoxMissing: true, first: list[0] };
        }

        return withPOBox || null;

      } catch (e) {

        console.error("[API ADDRESS ERROR]", e);
        return null;

      }

    },

    /* ========================================================= */
    /* API BANK */
    /* ========================================================= */

    _getBPBank: async function (bp) {

      const path = `/A_BusinessPartner('${bp}')/to_BusinessPartnerBank`;

      try {

        const oData = await this._readV2(path);
        const list = oData?.results || [];

        const best = list.find(x =>
          (x.BankAccountHolderName || "").trim() !== "" ||
          (x.BankAccountName || "").trim() !== ""
        );

        return best || list[0] || null;

      } catch (e) {

        console.error("[API BANK ERROR]", e);
        return null;

      }

    },

    /* ========================================================= */
    /* CONVERT */
    /* ========================================================= */

    onConvert: function () {

      if (!this._xmlFile) {
        MessageToast.show("Selecciona un XML");
        return;
      }

      const tipoSel = this.byId("sbTipo").getSelectedKey();

      const mapTipo = {
        INTER: "IB",
        TERC: "BX",
        REEM: "REEM",
        //REEM: "REEM"
        // RIB Y RBX
      };

      const tipoPOBox = mapTipo[tipoSel];

      const reader = new FileReader();

      reader.onload = async (e) => {

        try {

          const xmlString = e.target.result || "";

          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlString, "text/xml");

          const payments = xmlDoc.getElementsByTagNameNS(NS, "CdtTrfTxInf");

          const bankId =
            xmlDoc
              .getElementsByTagNameNS(NS, "MmbId")[0]
              ?.textContent
              ?.trim() || "";

          if (!payments.length) {
            MessageToast.show("No se encontraron pagos");
            return;
          }

          const bankData = await this._getBankData(bankId);
          const branch = bankData.branch || "";

          let pagosValidos = [];

          const tasks = Array.from(payments).map(async (p) => {

            /* BUSCAR POR NOMBRE PRIMERO */
            const name = this._getNameFromPayment(p);
            console.log("Nombre de BP =>", name);
            let bp = await this._resolveBPFromName(name);
            console.log("Numero de BP =>", bp);

            /* FALLBACK A RFC SI NO ENCUENTRA */
            if (!bp) {

              const taxId = this._getTaxIdFromPayment(p);
              

              if (taxId) {
                bp = await this._resolveBPFromTaxId(taxId);
                console.log("TAX =>", bp);
              }

            }

            if (!bp) return null;

            const addr = await this._getBPAddressWithPOBox(bp);
            console.log("Addr =>", addr);

            if (!addr) return null;

            if (addr.__exists && addr.__poBoxMissing) return null;

            const poBox = (addr.POBox || addr.PoBox || "")
              .trim()
              .toUpperCase();

            if (poBox !== tipoPOBox) return null;
            console.log("poBox =>", poBox);
            console.log("tipoPOBox =>", tipoPOBox);
            
            const bankBP = await this._getBPBank(bp);

            return {
              xmlNode: p,
              bpId: bp,
              poBox: poBox,
              branch: branch,
              holder: bankBP?.BankAccountHolderName || "",
              currency: bankBP?.BankAccountName || ""
            };

          });

          const results = await Promise.all(tasks);

          pagosValidos = results.filter(x => x !== null);

          let txt = "";

          if (tipoSel === "INTER") {

            txt = Interbancarios.convert(xmlString, pagosValidos);
            MessageToast.show(`Conversión de Interbancarios Exitosa`);

          } else if (tipoSel === "TERC") {

            txt = Terceros.convert(xmlString, pagosValidos);
            MessageToast.show(`Conversión de Terceros Exitosa`);

          } else if (tipoSel === "REEM") {

            txt = Reembolsos.convert(xmlString, pagosValidos);
            MessageToast.show(`Conversión de Reembolsos Exitosa`);

          }

          this._txtContent = txt;

          this.byId("taTxt").setValue(txt);
          this.byId("btnDownload").setEnabled(!!txt);

        } catch (err) {

          console.error(err);
          MessageToast.show("Error en conversión o Credenciales Incorrectas");

        }

      };

      reader.readAsText(this._xmlFile);

    },

    /* ========================================================= */
    /* DOWNLOAD */
    /* ========================================================= */

    onDownload: function () {

      if (!this._txtContent) {
        MessageToast.show("Primero convierte para generar el TXT");
        return;
      }

      const xmlName = this._xmlFile?.name || "archivo";

      const baseName = xmlName.replace(/\.xml$/i, "") || "archivo";

      FileUtil.save(
        this._txtContent,
        baseName,
        "txt",
        "text/plain;charset=utf-8"
      );

    }

  });

});