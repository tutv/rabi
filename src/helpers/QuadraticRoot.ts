/** ax^2 + bx + c = 0 */
export function findX(a: number, b: number, c: number) {
    // program to solve quadratic equation
    let root1, root2

    // calculate discriminant
    const discriminant = b * b - 4 * a * c

    // condition for real and different roots
    if (discriminant > 0) {
        root1 = (-b + Math.sqrt(discriminant)) / (2 * a)
        root2 = (-b - Math.sqrt(discriminant)) / (2 * a)

        // result

        return Math.max(root1, root2)
    }

    // condition for real and equal roots
    else if (discriminant == 0) {
        root1 = root2 = -b / (2 * a)

        // result

        return root1
    }

    return null
}

export function findY(a: number, b: number, c: number, x: number) {

    // y = a * x^2 + bx + c
    return a * x * x + b * x + c
}

export function isXInteger(y: number) {

    const x = findX(2, -2, 1 - y)

    if (x === null) return false

    const xInteger = parseInt(x + '', 10)

    return (2 * xInteger * xInteger - 2 * xInteger + 1) === y
}