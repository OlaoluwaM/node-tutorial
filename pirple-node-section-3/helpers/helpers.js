function normalize(value) {
  const valueAsString = JSON.stringify(value, (_, val) =>
    val === '' || val === void 0 ? null : val
  ).trim();
  return JSON.parse(valueAsString);
}

const myHelpers = {
  acceptableMethods: ['post', 'get', 'put', 'delete'],

  validateType(value, desiredType) {
    if (!value) return false;
    const normalizedValue = normalize(value);
    const rawType = Object.prototype.toString
      .call(normalizedValue)
      .replace(/\W/g, '')
      .split('object')[1]
      .toLowerCase();

    return rawType === desiredType;
  },
  extractedPayloadDataObj(payload) {
    if (!payload) return false;
    const object = {
      firstName: myHelpers.validateType(payload?.firstName, 'string')
        ? payload.firstName.trim()
        : false,
      lastName: myHelpers.validateType(payload?.lastName, 'string')
        ? payload.lastName.trim()
        : false,
      phone:
        myHelpers.validateType(payload?.phone, 'string') && payload.phone.trim().length === 10
          ? payload.phone.trim()
          : false,
      password: myHelpers.validateType(payload?.password, 'string')
        ? payload.password.trim()
        : false,
      tosAgreement:
        myHelpers.validateType(payload?.tosAgreement, 'boolean') && payload.tosAgreement === true
          ? true
          : false,
      id:
        myHelpers.validateType(payload?.Id, 'string') && payload?.Id.trim().length === 20
          ? payload?.Id.trim()
          : false,
      protocol:
        myHelpers.validateType(payload?.protocol, 'string') &&
        ['https', 'http'].includes(payload?.protocol)
          ? payload?.protocol.trim()
          : false,
      url:
        myHelpers.validateType(payload?.url, 'string') && payload?.url.trim().length > 0
          ? payload?.url.trim()
          : false,
      method:
        myHelpers.validateType(payload?.method, 'string') &&
        myHelpers.acceptableMethods.includes(payload.method)
          ? payload.method
          : false,
      successCodes:
        myHelpers.validateType(payload?.successCodes, 'array') && payload.successCodes.length > 0
          ? payload.successCodes
          : false,
      timeoutSeconds:
        myHelpers.validateType(payload?.timeoutSeconds, 'number') &&
        payload.timeoutSeconds % 1 === 0 &&
        payload.timeoutSeconds >= 1 &&
        payload.timeoutSeconds <= 5
          ? payload.timeoutSeconds
          : false,
      checks: myHelpers.validateType(payload?.checks, 'array') ? payload.checks : [],
    };
    return Object.fromEntries(Object.entries(object).filter(v => v[1] !== false));
  },
  colorizeLog(colorCodes, str) {
    const { '0': bgColor, '1': fgColor } = colorCodes;
    return `\x1b[${bgColor}m${str}\x1b[${fgColor}m`;
  },
};

module.exports = myHelpers;
