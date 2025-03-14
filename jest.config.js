module.exports = {
    preset: 'ts-jest',
    roots: ['<rootDir>'],
    testEnvironment: 'node',
    moduleDirectories: [
        'node_modules',
    ],
    modulePathIgnorePatterns: ['dist'],
    transform: {
        '\\.ts?$': [
            'ts-jest',
            {
                useESM: true,
            },
        ],
    },
    moduleNameMapper: {
        '(.+)\\.js': '$1',
    },
    extensionsToTreatAsEsm: [
        '.ts',
    ],
};
