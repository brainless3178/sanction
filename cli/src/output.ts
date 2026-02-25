import ora from 'ora';
import chalk from 'chalk';

export function startSpinner(text: string) {
    return ora(text).start();
}

export function success(message: string, isJson: boolean = false, data?: any) {
    if (isJson) {
        console.log(JSON.stringify({ status: 'success', message, data }, null, 2));
    } else {
        console.log(chalk.green('✔') + ' ' + message);
        if (data) {
            console.log(chalk.gray(JSON.stringify(data, (key, value) => {
                return typeof value === 'bigint' ? value.toString() : value;
            }, 2)));
        }
    }
}

export function error(message: string, isJson: boolean = false) {
    if (isJson) {
        console.log(JSON.stringify({ status: 'error', message }, null, 2));
    } else {
        console.log(chalk.red('✖') + ' ' + message);
    }
    process.exit(1);
}
