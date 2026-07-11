#!/bin/bash

RESOLVED_BOT_INSTANCES=()

_add_resolved_bot_instance() {
    local instance="$1"

    if [[ ! "$instance" =~ ^[1-9][0-9]*$ ]]; then
        echo "[ERROR] Invalid BOT_INSTANCE '$instance'. Use positive integer IDs such as 1, 2, or 3."
        return 1
    fi

    local existing
    for existing in "${RESOLVED_BOT_INSTANCES[@]}"; do
        if [ "$existing" = "$instance" ]; then
            return 0
        fi
    done

    RESOLVED_BOT_INSTANCES+=("$instance")
}

resolve_bot_instances() {
    local project_dir="${1:-.}"
    local raw_instances="${BOT_INSTANCES:-}"

    RESOLVED_BOT_INSTANCES=()

    if [ -n "$raw_instances" ]; then
        raw_instances="${raw_instances//,/ }"

        local instance
        for instance in $raw_instances; do
            _add_resolved_bot_instance "$instance" || return 1
        done
    else
        local config_dir="$project_dir/configs"
        local discovered=()

        if [ -d "$config_dir" ]; then
            shopt -s nullglob
            local config_files=("$config_dir"/botConfig.*.json)
            shopt -u nullglob

            local file base instance
            for file in "${config_files[@]}"; do
                base="${file##*/}"
                instance="${base#botConfig.}"
                instance="${instance%.json}"

                if [[ "$instance" =~ ^[1-9][0-9]*$ ]]; then
                    discovered+=("$instance")
                fi
            done
        fi

        if [ "${#discovered[@]}" -eq 0 ]; then
            discovered=("1")
        elif [ "${#discovered[@]}" -gt 1 ]; then
            mapfile -t discovered < <(printf '%s\n' "${discovered[@]}" | sort -n)
        fi

        local discovered_instance
        for discovered_instance in "${discovered[@]}"; do
            _add_resolved_bot_instance "$discovered_instance" || return 1
        done
    fi

    if [ "${#RESOLVED_BOT_INSTANCES[@]}" -eq 0 ]; then
        echo "[ERROR] No valid BOT_INSTANCE values were resolved."
        return 1
    fi
}

require_bot_config_files() {
    local project_dir="${1:-.}"
    local missing="false"
    local instance config_file

    for instance in "${RESOLVED_BOT_INSTANCES[@]}"; do
        config_file="$project_dir/configs/botConfig.$instance.json"

        if [ ! -f "$config_file" ]; then
            echo "[ERROR] Missing required config: configs/botConfig.$instance.json"
            missing="true"
        fi
    done

    if [ "$missing" = "true" ]; then
        echo "[ERROR] Create the missing botConfig.<instance>.json files before starting Auto-Ban with PM2 or Docker."
        return 1
    fi
}

join_bot_instances() {
    local delimiter="${1:-,}"
    local old_ifs="$IFS"

    IFS="$delimiter"
    echo "${RESOLVED_BOT_INSTANCES[*]}"
    IFS="$old_ifs"
}
