const crypto = require('crypto');
const readline = require('readline');

// Utility Class: Parser
class Parser {
    static parseDiceArguments(args) {
        if (args.length < 3) {
            throw new Error('At least 3 dice configurations are required.');
        }

        return args.map(arg => {
            const values = arg.split(',').map(value => {
                const num = parseInt(value, 10);
                if (isNaN(num)) {
                    throw new Error(`Invalid value "${value}" in dice configuration.`);
                }
                return num;
            });

            if (values.length < 4) {
                throw new Error('Each dice must have at least 4 faces.');
            }

            return values;
        });
    }
}

// Dice Class
class Dice {
    constructor(faces) {
        this.faces = faces;
    }

    roll(faceIndex) {
        if (faceIndex < 0 || faceIndex >= this.faces.length) {
            throw new Error('Invalid face index.');
        }
        return this.faces[faceIndex];
    }

    toString() {
        return this.faces.join(',');
    }
}

// FairRandom Class
class FairRandom {
    static generateRandomInRange(range) {
        const randomBytes = crypto.randomBytes(32); // 256 bits
        const max = Math.floor(2 ** 256 / range) * range;
        let num;

        do {
            num = BigInt('0x' + randomBytes.toString('hex'));
        } while (num >= BigInt(max));

        return Number(num % BigInt(range));
    }

    static calculateHMAC(key, message) {
        return crypto.createHmac('sha3-256', key).update(message).digest('hex');
    }

    static async generateFairNumber(range, rl) {
        const secretKey = crypto.randomBytes(32).toString('hex');
        const computerNumber = this.generateRandomInRange(range);
        const hmac = this.calculateHMAC(secretKey, computerNumber.toString());

        console.log(`I selected a random value in the range 0..${range - 1} (HMAC=${hmac}).`);
        console.log('Add your number modulo ' + range + '.');

        for (let i = 0; i < range; i++) {
            console.log(`${i} - ${i}`);
        }
        console.log('X - exit');
        console.log('? - help');

        const userNumber = await new Promise(resolve => {
            rl.question('Your selection: ', answer => resolve(answer.trim()));
        });

        if (userNumber === 'X') {
            console.log('Exiting...');
            process.exit(0);
        } else if (userNumber === '?') {
            console.log('Help: Select a number between 0 and ' + (range - 1) + '.');
            return this.generateFairNumber(range, rl); // Re-prompt after help
        }

        const parsedUserNumber = parseInt(userNumber, 10);
        if (isNaN(parsedUserNumber) || parsedUserNumber < 0 || parsedUserNumber >= range) {
            console.log('Invalid selection. Try again.');
            return this.generateFairNumber(range, rl); // Re-prompt on invalid input
        }

        const result = (computerNumber + parsedUserNumber) % range;
        console.log(`My number is ${computerNumber} (KEY=${secretKey}).`);
        console.log(`The fair number generation result is ${computerNumber} + ${parsedUserNumber} = ${result} (mod ${range}).`);
        return result;
    }
}

// Probability Class
class Probability {
    static calculateWinProbability(diceA, diceB) {
        let wins = 0;
        const total = diceA.faces.length * diceB.faces.length;

        for (const faceA of diceA.faces) {
            for (const faceB of diceB.faces) {
                if (faceA > faceB) wins++;
            }
        }

        return (wins / total) * 100;
    }
}

// HelpTable Class
class HelpTable {
    constructor(diceList) {
        this.diceList = diceList;
    }

    generateTable() {
        const table = [];
        table.push(['Dice Pair', 'Win Probability']);

        for (let i = 0; i < this.diceList.length; i++) {
            for (let j = i + 1; j < this.diceList.length; j++) {
                const prob = Probability.calculateWinProbability(this.diceList[i], this.diceList[j]);
                table.push([`${i}-${j}`, `${prob.toFixed(2)}%`]);
            }
        }

        return this.formatTable(table);
    }

    formatTable(table) {
        const columnWidths = table[0].map((_, colIndex) =>
            Math.max(...table.map(row => row[colIndex].length))
        );

        return table
            .map(row =>
                row
                    .map((cell, colIndex) => cell.padEnd(columnWidths[colIndex]))
                    .join(' | ')
            )
            .join('\n');
    }
}

// Game Class
class Game {
    constructor(diceList) {
        this.diceList = diceList;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
    }

    start() {
        console.log("Let's determine who makes the first move.");

        // Step 1: Determine who goes first
        FairRandom.generateFairNumber(2, this.rl)
            .then(firstMove => {
                const isComputerFirst = firstMove === 1;
                console.log(isComputerFirst ? 'I make the first move.' : 'You make the first move.');

                // Step 2: Select dice and perform rolls
                this.playRound(isComputerFirst);
            })
            .catch(error => {
                console.error('An error occurred:', error.message);
                this.rl.close();
                process.exit(1);
            });
    }

    playRound(isComputerFirst) {
        if (isComputerFirst) {
            this.computerTurn()
                .then(() => this.userTurn())
                .catch(error => {
                    console.error('An error occurred:', error.message);
                    this.rl.close();
                    process.exit(1);
                });
        } else {
            this.userTurn()
                .then(() => this.computerTurn())
                .catch(error => {
                    console.error('An error occurred:', error.message);
                    this.rl.close();
                    process.exit(1);
                });
        }
    }

    async userTurn() {
        console.log('Choose your dice:');
        this.diceList.forEach((dice, index) => {
            console.log(`${index} - ${dice}`);
        });
        console.log('X - exit');
        console.log('? - help');

        const choice = await new Promise(resolve => {
            this.rl.question('Your selection: ', answer => resolve(answer.trim()));
        });

        if (choice === 'X') {
            console.log('Exiting...');
            this.rl.close();
            process.exit(0);
        } else if (choice === '?') {
            console.log(new HelpTable(this.diceList).generateTable());
            return this.userTurn(); // Re-prompt after showing help
        }

        const diceIndex = parseInt(choice, 10);
        if (isNaN(diceIndex) || diceIndex < 0 || diceIndex >= this.diceList.length) {
            console.log('Invalid selection. Try again.');
            return this.userTurn(); // Re-prompt on invalid input
        }

        const dice = this.diceList[diceIndex];
        const rollResult = await this.performRoll(dice);
        console.log(`Your roll result is ${rollResult}.`);
    }

    async computerTurn() {
        const diceIndex = FairRandom.generateRandomInRange(this.diceList.length);
        const dice = this.diceList[diceIndex];
        const rollResult = await this.performRoll(dice);
        console.log(`I choose the [${dice}] dice.`);
        console.log(`My roll result is ${rollResult}.`);
    }

    async performRoll(dice) {
        const faceIndex = await FairRandom.generateFairNumber(dice.faces.length, this.rl);
        return dice.roll(faceIndex);
    }
}

// Main Execution
(async () => {
    const args = process.argv.slice(2);

    try {
        // Validate and parse dice configurations
        const diceConfigs = Parser.parseDiceArguments(args);
        const diceList = diceConfigs.map(config => new Dice(config));

        // Start the game
        const game = new Game(diceList);
        game.start();
    } catch (error) {
        console.error(error.message);
        console.log('Example usage: node index.js 2,2,4,4,9,9 6,8,1,1,8,6 7,5,3,7,5,3');
    }
})();