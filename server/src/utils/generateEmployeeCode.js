const generateEmployeeCode = async (
    connection,
    role
) => {
    let prefix;

    if (role === "EMPLOYEE") {
        prefix = "EMP";
    } else if (role === "ADMIN") {
        prefix = "ADM";
    } else {
        throw new Error(
            "Employee code can only be generated for EMPLOYEE or ADMIN"
        );
    }

    const [rows] = await connection.query(
        `
        SELECT MAX(
            CAST(
                SUBSTRING(employee_code, 4)
                AS UNSIGNED
            )
        ) AS lastNumber
        FROM users
        WHERE role = ?
          AND employee_code LIKE ?
        `,
        [
            role,
            `${prefix}%`,
        ]
    );

    const lastNumber =
        Number(rows[0]?.lastNumber) || 0;

    const nextNumber =
        lastNumber + 1;

    return `${prefix}${String(
        nextNumber
    ).padStart(3, "0")}`;
};

module.exports = generateEmployeeCode;