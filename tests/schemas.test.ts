import { describe, expect, it } from "vitest";
import { camposEsperados, validarExtraccion } from "@/lib/schemas";
import {
  conDatos,
  contratoValido,
  facturaValida,
  reciboValido,
  sinCampo,
} from "./fixtures";

describe("factura", () => {
  it("no da errores cuando está completa y cuadra", () => {
    expect(validarExtraccion(facturaValida)).toEqual({});
  });

  it("marca los campos obligatorios que faltan", () => {
    const sinNumero = sinCampo(facturaValida, "numero");
    expect(validarExtraccion(sinNumero)).toMatchObject({
      "datos.numero": "Falta este campo obligatorio",
    });
  });

  it("marca varios campos obligatorios a la vez", () => {
    const incompleta = sinCampo(sinCampo(facturaValida, "numero"), "emisor");
    const issues = validarExtraccion(incompleta);
    expect(Object.keys(issues).sort()).toEqual(["datos.emisor", "datos.numero"]);
  });

  it("marca el nombre que falta dentro del emisor", () => {
    const issues = validarExtraccion(conDatos(facturaValida, { emisor: {} }));
    expect(issues["datos.emisor.nombre"]).toBe("Falta este campo obligatorio");
  });

  it("rechaza una fecha con formato español", () => {
    const issues = validarExtraccion(
      conDatos(facturaValida, { fecha_emision: "15/09/2026" }),
    );
    expect(issues["datos.fecha_emision"]).toMatch(/Fecha no válida/);
  });

  it("rechaza una fecha que no existe en el calendario", () => {
    const issues = validarExtraccion(
      conDatos(facturaValida, { fecha_emision: "2026-02-31" }),
    );
    expect(issues["datos.fecha_emision"]).toMatch(/Fecha no válida/);
  });

  it("rechaza un vencimiento anterior a la emisión", () => {
    const issues = validarExtraccion(
      conDatos(facturaValida, { fecha_vencimiento: "2026-09-01" }),
    );
    expect(issues["datos.fecha_vencimiento"]).toBe(
      "Anterior a la fecha de emisión",
    );
  });

  it("acepta un vencimiento posterior", () => {
    const issues = validarExtraccion(
      conDatos(facturaValida, { fecha_vencimiento: "2026-10-15" }),
    );
    expect(issues).toEqual({});
  });

  it("detecta que subtotal + impuestos no cuadra con el total", () => {
    const issues = validarExtraccion(conDatos(facturaValida, { total: 99 }));
    expect(issues["datos.total"]).toBe(
      "No cuadra: subtotal + impuestos = 13.55",
    );
  });

  it("tolera diferencias de un céntimo por redondeo", () => {
    const issues = validarExtraccion(conDatos(facturaValida, { total: 13.56 }));
    expect(issues).toEqual({});
  });

  it("detecta el descuadre aunque falten otros campos", () => {
    const rota = conDatos(sinCampo(facturaValida, "numero"), { total: 50 });
    const issues = validarExtraccion(rota);
    expect(issues["datos.total"]).toMatch(/No cuadra/);
    expect(issues["datos.numero"]).toBe("Falta este campo obligatorio");
  });

  it("rechaza un total que llega como texto", () => {
    const issues = validarExtraccion(conDatos(facturaValida, { total: "13,55" }));
    expect(issues["datos.total"]).toBe("Debe ser un número");
  });

  it("rechaza una moneda que no es código ISO", () => {
    const issues = validarExtraccion(conDatos(facturaValida, { moneda: "euros" }));
    expect(issues["datos.moneda"]).toMatch(/ISO/);
  });

  it("exige al menos un concepto", () => {
    const issues = validarExtraccion(conDatos(facturaValida, { conceptos: [] }));
    expect(issues["datos.conceptos"]).toBe("Debe haber al menos un concepto");
  });

  it("señala el concepto concreto que está mal", () => {
    const issues = validarExtraccion(
      conDatos(facturaValida, {
        conceptos: [{ descripcion: "Cuaderno", importe: "siete" }],
      }),
    );
    expect(issues["datos.conceptos.0.importe"]).toBe("Debe ser un número");
  });
});

describe("recibo", () => {
  it("acepta un recibo completo", () => {
    expect(validarExtraccion(reciboValido)).toEqual({});
  });

  it("exige la fecha", () => {
    expect(validarExtraccion(sinCampo(reciboValido, "fecha"))).toMatchObject({
      "datos.fecha": "Falta este campo obligatorio",
    });
  });

  it("también comprueba que los importes cuadren", () => {
    const issues = validarExtraccion(conDatos(reciboValido, { total: 10 }));
    expect(issues["datos.total"]).toMatch(/No cuadra/);
  });

  it("no exige número de recibo", () => {
    expect(validarExtraccion(sinCampo(reciboValido, "numero"))).toEqual({});
  });
});

describe("contrato", () => {
  it("acepta un contrato completo", () => {
    expect(validarExtraccion(contratoValido)).toEqual({});
  });

  it("exige al menos dos partes", () => {
    const issues = validarExtraccion(
      conDatos(contratoValido, { partes: [{ nombre: "Solo una" }] }),
    );
    expect(issues["datos.partes"]).toBe("Debe haber al menos dos partes");
  });

  it("rechaza un fin anterior al inicio", () => {
    const issues = validarExtraccion(
      conDatos(contratoValido, { fecha_fin: "2025-01-01" }),
    );
    expect(issues["datos.fecha_fin"]).toBe("Anterior a la fecha de inicio");
  });

  it("exige título y objeto", () => {
    const issues = validarExtraccion(sinCampo(sinCampo(contratoValido, "titulo"), "objeto"));
    expect(Object.keys(issues).sort()).toEqual(["datos.objeto", "datos.titulo"]);
  });
});

describe("otro", () => {
  it("no exige ningún campo", () => {
    const issues = validarExtraccion({
      tipo: "otro",
      datos: { cualquier_cosa: "valor" },
    });
    expect(issues).toEqual({});
  });

  it("acepta incluso sin datos", () => {
    const issues = validarExtraccion({ tipo: "otro", datos: {} });
    expect(issues).toEqual({});
  });
});

describe("camposEsperados", () => {
  it("devuelve los campos del esquema en orden", () => {
    expect(camposEsperados("factura").slice(0, 3)).toEqual([
      "numero",
      "fecha_emision",
      "fecha_vencimiento",
    ]);
  });

  it("no devuelve campos para un documento sin esquema fijo", () => {
    expect(camposEsperados("otro")).toEqual([]);
  });
});
