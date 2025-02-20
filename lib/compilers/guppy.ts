// Copyright (c) 2019, Sebastian Rath
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
//     * Redistributions of source code must retain the above copyright notice,
//       this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.

import _ from 'underscore';
import {ParsedAsmResultLine} from '../../types/asmresult/asmresult.interfaces.js';
import {LLVMIrBackendOptions} from '../../types/compilation/ir.interfaces.js';
import {PreliminaryCompilerInfo} from '../../types/compiler.interfaces.js';
import type {ParseFiltersAndOutputOptions} from '../../types/features/filters.interfaces.js';
import {BaseCompiler} from '../base-compiler.js';
import * as cfg from '../cfg/cfg.js';
import {CompilationEnvironment} from '../compilation-env.js';
import {logger} from '../logger.js';

export class GuppyCompiler extends BaseCompiler {
    static get key() {
        return 'guppy';
    }

    constructor(info: PreliminaryCompilerInfo, env: CompilationEnvironment) {
        super(info, env);
        this.compiler.supportsIntel = false;
        this.compiler.supportsIrView = true;
    }

    override optionsForFilter(filters: ParseFiltersAndOutputOptions, outputFilename: string, userOptions?: string[]) {
        // The compiler exe should point to [`guppyc`](https://github.com/CQCL/guppyc).
        return ['--guppy-version', this.compiler.semver, '--llvm', outputFilename];
    }

    override isCfgCompiler() {
        return true;
    }

    // This function is normally used to generate LLVM IR views.
    //
    // We reuse it to generate HUGR S-Expressions instead.
    override async generateIR(
        inputFilename: string,
        options: string[],
        irOptions: LLVMIrBackendOptions,
        produceCfg: boolean,
        filters: ParseFiltersAndOutputOptions,
    ) {
        const newOptions = options.concat(['--sexpr', this.getIrOutputFilename(inputFilename, filters)]);

        logger.warn('Generating HUGR S-Expressions using options:', newOptions);

        const execOptions = this.getDefaultExecOptions();

        const output = await this.runCompiler(this.compiler.exe, newOptions, this.filename(inputFilename), execOptions);
        if (output.code !== 0) {
            return {
                asm: [
                    {
                        text: 'Failed to run compiler to get IR code\n\n' + _.pluck(output.stderr, 'text').join('\n'),
                    },
                ],
            };
        }
        const ir = await this.processIrOutput(output, irOptions, filters);

        const result: {
            asm: ParsedAsmResultLine[];
            cfg?: Record<string, cfg.CFG>;
        } = {
            asm: ir.asm,
        };
        return result;
    }
}
