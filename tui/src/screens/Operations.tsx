import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';



interface OperationScreenProps {
    onBack: () => void;
    onSubmit: (action: string, params: Record<string, string>) => void;
}


export const MintScreen: React.FC<OperationScreenProps> = ({ onBack, onSubmit }) => {
    const [step, setStep] = useState<'recipient' | 'amount'>('recipient');
    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');

    useInput((_input, key) => {
        if (key.escape) onBack();
    });

    const handleSubmit = (value: string) => {
        if (step === 'recipient') {
            setRecipient(value);
            setStep('amount');
        } else {
            setAmount(value);
            onSubmit('mint', { recipient, amount: value });
            onBack();
        }
    };

    return (
        <Box flexDirection="column" borderStyle="doubleSingle" paddingX={2} paddingY={1}>
            <Text bold color="green">MINT TOKENS</Text>
            <Text dimColor>Press ESC to cancel</Text>
            <Box marginTop={1}>
                {step === 'recipient' ? (
                    <Box>
                        <Text>Recipient: </Text>
                        <TextInput value={recipient} onChange={setRecipient} onSubmit={handleSubmit} />
                    </Box>
                ) : (
                    <Box>
                        <Text>Amount: </Text>
                        <TextInput value={amount} onChange={setAmount} onSubmit={handleSubmit} />
                    </Box>
                )}
            </Box>
        </Box>
    );
};


export const BlacklistScreen: React.FC<OperationScreenProps> = ({ onBack, onSubmit }) => {
    const [step, setStep] = useState<'address' | 'reason'>('address');
    const [address, setAddress] = useState('');
    const [reason, setReason] = useState('');

    useInput((_input, key) => {
        if (key.escape) onBack();
    });

    const handleSubmit = (value: string) => {
        if (step === 'address') {
            setAddress(value);
            setStep('reason');
        } else {
            setReason(value);
            onSubmit('blacklist', { address, reason: value });
            onBack();
        }
    };

    return (
        <Box flexDirection="column" borderStyle="doubleSingle" paddingX={2} paddingY={1}>
            <Text bold color="red">BLACKLIST ADDRESS</Text>
            <Text dimColor>Press ESC to cancel</Text>
            <Box marginTop={1}>
                {step === 'address' ? (
                    <Box>
                        <Text>Address: </Text>
                        <TextInput value={address} onChange={setAddress} onSubmit={handleSubmit} />
                    </Box>
                ) : (
                    <Box>
                        <Text>Reason: </Text>
                        <TextInput value={reason} onChange={setReason} onSubmit={handleSubmit} />
                    </Box>
                )}
            </Box>
        </Box>
    );
};


export const SeizeScreen: React.FC<OperationScreenProps> = ({ onBack, onSubmit }) => {
    const [step, setStep] = useState<'source' | 'destination'>('source');
    const [source, setSource] = useState('');
    const [destination, setDestination] = useState('');

    useInput((_input, key) => {
        if (key.escape) onBack();
    });

    const handleSubmit = (value: string) => {
        if (step === 'source') {
            setSource(value);
            setStep('destination');
        } else {
            setDestination(value);
            onSubmit('seize', { source, destination: value });
            onBack();
        }
    };

    return (
        <Box flexDirection="column" borderStyle="doubleSingle" paddingX={2} paddingY={1}>
            <Text bold color="magenta">SEIZE FUNDS</Text>
            <Text dimColor>Press ESC to cancel</Text>
            <Box marginTop={1}>
                {step === 'source' ? (
                    <Box>
                        <Text>Source: </Text>
                        <TextInput value={source} onChange={setSource} onSubmit={handleSubmit} />
                    </Box>
                ) : (
                    <Box>
                        <Text>Destination: </Text>
                        <TextInput value={destination} onChange={setDestination} onSubmit={handleSubmit} />
                    </Box>
                )}
            </Box>
        </Box>
    );
};
